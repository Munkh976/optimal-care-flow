ALTER TABLE public.conversation_sessions
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS contact_preference text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_status text NOT NULL DEFAULT 'new';

ALTER TYPE public.conversation_session_status ADD VALUE IF NOT EXISTS 'submitted';

CREATE OR REPLACE FUNCTION public.flow_session_submit_intake(
  p_session_id uuid,
  p_token text,
  p_name text,
  p_phone text,
  p_email text,
  p_preference text,
  p_total_score numeric DEFAULT 0,
  p_trait_scores jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversation_sessions
  SET status = 'submitted'::conversation_session_status,
      submitted_at = now(),
      completed_at = now(),
      current_node_id = NULL,
      total_score = p_total_score,
      trait_scores = p_trait_scores,
      client_name = NULLIF(btrim(p_name), ''),
      client_phone = NULLIF(btrim(p_phone), ''),
      client_email = NULLIF(btrim(p_email), ''),
      contact_preference = NULLIF(btrim(p_preference), ''),
      contact_name = COALESCE(NULLIF(btrim(p_name), ''), contact_name),
      contact_email = COALESCE(NULLIF(btrim(p_email), ''), contact_email),
      contact_phone = COALESCE(NULLIF(btrim(p_phone), ''), contact_phone)
  WHERE id = p_session_id
    AND session_token = p_token;
END;
$$;

CREATE POLICY "Staff can update session follow up"
ON public.conversation_sessions
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR has_role(auth.uid(), 'agency_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'hr_staff'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR has_role(auth.uid(), 'agency_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'hr_staff'::app_role)
);

GRANT UPDATE ON public.conversation_sessions TO authenticated;

INSERT INTO public.system_modules (module_code, module_name, description, category, is_active)
VALUES ('client_inquiries', 'Client Inquiries', 'Review family intake requests submitted from the assistant', 'operations', true)
ON CONFLICT (module_code) DO NOTHING;

INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT r::app_role, 'client_inquiries', false, true, true, false
FROM unnest(ARRAY['system_admin','agency_admin','manager','hr_staff']) AS r
ON CONFLICT DO NOTHING;