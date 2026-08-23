CREATE OR REPLACE FUNCTION public.flow_session_submit_intake(p_session_id uuid, p_token text, p_name text, p_phone text, p_email text, p_preference text, p_total_score numeric DEFAULT 0, p_trait_scores jsonb DEFAULT '{}'::jsonb, p_agency_id uuid DEFAULT NULL::uuid, p_virtual_office_id uuid DEFAULT NULL::uuid)
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
BEGIN
  SELECT (status = 'submitted'::conversation_session_status)
    INTO v_already
  FROM public.conversation_sessions
  WHERE id = p_session_id AND session_token = p_token;

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

  IF v_updated IS NULL OR p_agency_id IS NULL OR COALESCE(v_already, false) THEN
    RETURN;
  END IF;

  INSERT INTO public.families (agency_id, virtual_office_id, family_name, notes, is_demo)
  VALUES (
    p_agency_id,
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
    agency_id, virtual_office_id, family_id, status, source, priority, care_type_codes, notes, is_demo
  )
  VALUES (
    p_agency_id,
    p_virtual_office_id,
    v_family_id,
    'new'::care_request_status,
    'public_site',
    'normal',
    ARRAY[]::text[],
    'Public site intake. Preferred contact: ' || COALESCE(NULLIF(btrim(p_preference), ''), 'not set'),
    false
  );
END;
$function$;