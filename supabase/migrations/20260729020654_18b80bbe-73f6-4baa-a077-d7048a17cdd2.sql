CREATE OR REPLACE FUNCTION public.flow_session_link_registration(p_session_id uuid, p_token text, p_registration_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.conversation_sessions
  SET registration_id = p_registration_id
  WHERE id = p_session_id
    AND session_token = p_token;
$$;

DROP POLICY IF EXISTS "Staff can read agency sessions" ON public.conversation_sessions;
CREATE POLICY "Staff can read agency sessions" ON public.conversation_sessions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR has_role(auth.uid(), 'agency_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'hr_staff'::app_role)
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Staff can read answers" ON public.conversation_answers;
CREATE POLICY "Staff can read answers" ON public.conversation_answers
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR has_role(auth.uid(), 'agency_admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'hr_staff'::app_role)
);