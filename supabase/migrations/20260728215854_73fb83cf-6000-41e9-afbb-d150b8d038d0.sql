
CREATE OR REPLACE FUNCTION public.flow_session_progress(
  p_session_id uuid,
  p_token text,
  p_node_id uuid
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.conversation_sessions
  SET current_node_id = p_node_id
  WHERE id = p_session_id
    AND session_token = p_token
    AND status = 'in_progress';
$$;

CREATE OR REPLACE FUNCTION public.flow_session_complete(
  p_session_id uuid,
  p_token text,
  p_total_score numeric,
  p_trait_scores jsonb,
  p_band text,
  p_contact_name text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.conversation_sessions
  SET status = 'completed',
      completed_at = now(),
      current_node_id = NULL,
      total_score = p_total_score,
      trait_scores = p_trait_scores,
      band = p_band,
      contact_name = COALESCE(p_contact_name, contact_name),
      contact_email = COALESCE(p_contact_email, contact_email),
      contact_phone = COALESCE(p_contact_phone, contact_phone)
  WHERE id = p_session_id
    AND session_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.flow_session_trim_answers(
  p_session_id uuid,
  p_token text,
  p_from_index integer,
  p_node_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_sessions
    WHERE id = p_session_id AND session_token = p_token
  ) THEN
    RETURN;
  END IF;

  UPDATE public.conversation_answers
  SET is_active = false
  WHERE session_id = p_session_id
    AND sequence_index >= p_from_index;

  UPDATE public.conversation_sessions
  SET current_node_id = p_node_id
  WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.flow_session_progress(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flow_session_complete(uuid, text, numeric, jsonb, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flow_session_trim_answers(uuid, text, integer, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.flow_session_progress(uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flow_session_complete(uuid, text, numeric, jsonb, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flow_session_trim_answers(uuid, text, integer, uuid) TO anon, authenticated;
