-- 1. Additive columns
ALTER TABLE public.care_requests
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.conversation_sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS care_requests_session_id_key
  ON public.care_requests (session_id) WHERE session_id IS NOT NULL;

ALTER TABLE public.caregiver_registrations
  ADD COLUMN IF NOT EXISTS virtual_office_id uuid REFERENCES public.virtual_office(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2. Staff can update caregiver registrations (notes / office), but not approval fields
CREATE POLICY "Staff can update caregiver registrations"
ON public.caregiver_registrations
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'system_admin'::app_role)
    OR has_role(auth.uid(), 'agency_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'hr_staff'::app_role))
  AND (has_role(auth.uid(), 'system_admin'::app_role)
    OR agency_id IS NULL
    OR agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(), 'system_admin'::app_role)
    OR has_role(auth.uid(), 'agency_admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'hr_staff'::app_role))
  AND (has_role(auth.uid(), 'system_admin'::app_role)
    OR agency_id IS NULL
    OR agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()))
);

CREATE OR REPLACE FUNCTION public.protect_registration_review_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.status := OLD.status;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.email := OLD.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_registration_review_columns ON public.caregiver_registrations;
CREATE TRIGGER trg_protect_registration_review_columns
BEFORE UPDATE ON public.caregiver_registrations
FOR EACH ROW EXECUTE FUNCTION public.protect_registration_review_columns();

-- 3. Intake RPC: always create exactly one care_request per submitted intake, linked to the session
CREATE OR REPLACE FUNCTION public.flow_session_submit_intake(
  p_session_id uuid, p_token text, p_name text, p_phone text, p_email text, p_preference text,
  p_total_score numeric DEFAULT 0, p_trait_scores jsonb DEFAULT '{}'::jsonb,
  p_agency_id uuid DEFAULT NULL::uuid, p_virtual_office_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated uuid;
  v_family_id uuid;
  v_already boolean := false;
  v_name text := NULLIF(btrim(p_name), '');
  v_agency_id uuid;
BEGIN
  SELECT (s.status = 'submitted'::conversation_session_status),
         COALESCE(p_agency_id, s.agency_id, f.agency_id)
    INTO v_already, v_agency_id
  FROM public.conversation_sessions s
  JOIN public.conversation_flows f ON f.id = s.flow_id
  WHERE s.id = p_session_id AND s.session_token = p_token;

  -- Fall back to the only real agency when the flow is unscoped (legacy /assistant path)
  IF v_agency_id IS NULL OR v_agency_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    SELECT a.id INTO v_agency_id
    FROM public.agency a
    WHERE a.is_active AND a.id <> '00000000-0000-0000-0000-000000000000'::uuid
    LIMIT 1;
  END IF;

  UPDATE public.conversation_sessions
  SET status = 'submitted'::conversation_session_status,
      submitted_at = now(),
      completed_at = now(),
      current_node_id = NULL,
      total_score = p_total_score,
      trait_scores = p_trait_scores,
      client_name = v_name,
      client_phone = NULLIF(btrim(p_phone), ''),
      client_email = NULLIF(btrim(p_email), ''),
      contact_preference = NULLIF(btrim(p_preference), ''),
      contact_name = COALESCE(v_name, contact_name),
      contact_email = COALESCE(NULLIF(btrim(p_email), ''), contact_email),
      contact_phone = COALESCE(NULLIF(btrim(p_phone), ''), contact_phone),
      agency_id = COALESCE(p_agency_id, agency_id)
  WHERE id = p_session_id
    AND session_token = p_token
  RETURNING id INTO v_updated;

  IF v_updated IS NULL OR v_agency_id IS NULL OR COALESCE(v_already, false) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.care_requests WHERE session_id = p_session_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.families (agency_id, virtual_office_id, family_name, notes, is_demo)
  VALUES (
    v_agency_id,
    p_virtual_office_id,
    COALESCE(v_name, 'Website inquiry') || ' family',
    'Created from the public website intake assistant.',
    false
  )
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_contacts (family_id, first_name, last_name, email, phone, is_primary, is_decision_maker, is_demo)
  VALUES (
    v_family_id,
    COALESCE(split_part(COALESCE(v_name, 'Website inquiry'), ' ', 1), 'Website'),
    NULLIF(btrim(substr(COALESCE(v_name, ''), length(split_part(COALESCE(v_name, ''), ' ', 1)) + 1)), ''),
    NULLIF(btrim(p_email), ''),
    NULLIF(btrim(p_phone), ''),
    true,
    true,
    false
  );

  INSERT INTO public.care_requests (
    agency_id, virtual_office_id, family_id, session_id, status, source, priority, care_type_codes, notes, is_demo
  )
  VALUES (
    v_agency_id,
    p_virtual_office_id,
    v_family_id,
    p_session_id,
    'new'::care_request_status,
    CASE WHEN p_agency_id IS NULL THEN 'assistant_intake' ELSE 'public_site' END,
    'normal',
    ARRAY[]::text[],
    'Website intake. Preferred contact: ' || COALESCE(NULLIF(btrim(p_preference), ''), 'not set'),
    false
  );
END;
$function$;
