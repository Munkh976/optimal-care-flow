ALTER TABLE public.flow_options
  ADD COLUMN IF NOT EXISTS trait_weights jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.conversation_sessions
  ADD COLUMN IF NOT EXISTS trait_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.flow_options
SET trait_weights = jsonb_build_object(trait_tag, score_weight)
WHERE trait_tag IS NOT NULL
  AND trait_weights = '{}'::jsonb;