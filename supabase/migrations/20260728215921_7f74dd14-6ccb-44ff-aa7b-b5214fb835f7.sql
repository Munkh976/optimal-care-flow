
DROP POLICY IF EXISTS "Session holder can update own session" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Answers can be trimmed by session holder" ON public.conversation_answers;
