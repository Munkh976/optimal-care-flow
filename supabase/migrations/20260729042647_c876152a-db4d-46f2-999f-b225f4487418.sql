ALTER TABLE public.conversation_flows
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS draft_of uuid REFERENCES public.conversation_flows(id) ON DELETE SET NULL;

ALTER TABLE public.conversation_flows
  DROP CONSTRAINT IF EXISTS conversation_flows_status_check;
ALTER TABLE public.conversation_flows
  ADD CONSTRAINT conversation_flows_status_check
  CHECK (status IN ('draft','published','archived'));

UPDATE public.conversation_flows
SET status = CASE WHEN is_active THEN 'published' ELSE 'archived' END,
    published_at = COALESCE(published_at, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS conversation_flows_one_draft_per_audience
  ON public.conversation_flows (audience) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS conversation_flows_one_published_per_audience
  ON public.conversation_flows (audience) WHERE status = 'published';

-- Public readers must keep access to archived versions so screenings that are
-- already in progress can finish on the version they started on.
DROP POLICY IF EXISTS "Anyone can read active flows" ON public.conversation_flows;
CREATE POLICY "Anyone can read published or archived flows"
  ON public.conversation_flows FOR SELECT
  USING (status <> 'draft');

DROP POLICY IF EXISTS "Anyone can read nodes of active flows" ON public.flow_nodes;
CREATE POLICY "Anyone can read nodes of published flows"
  ON public.flow_nodes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conversation_flows f
    WHERE f.id = flow_nodes.flow_id AND f.status <> 'draft'
  ));

DROP POLICY IF EXISTS "Anyone can read options of active flows" ON public.flow_options;
CREATE POLICY "Anyone can read options of published flows"
  ON public.flow_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.flow_nodes n
    JOIN public.conversation_flows f ON f.id = n.flow_id
    WHERE n.id = flow_options.node_id AND f.status <> 'draft'
  ));

CREATE OR REPLACE FUNCTION public.create_flow_draft(p_flow_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_source public.conversation_flows%ROWTYPE;
  v_draft_id uuid;
  v_existing uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised to edit conversations';
  END IF;

  SELECT * INTO v_source FROM public.conversation_flows WHERE id = p_flow_id;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  SELECT id INTO v_existing FROM public.conversation_flows
  WHERE audience = v_source.audience AND status = 'draft';
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  v_draft_id := gen_random_uuid();

  INSERT INTO public.conversation_flows (
    id, agency_id, audience, name, description, version, is_active,
    entry_node_id, strong_fit_threshold, review_threshold, status, draft_of
  )
  VALUES (
    v_draft_id, v_source.agency_id, v_source.audience, v_source.name, v_source.description,
    (SELECT COALESCE(MAX(version), 0) + 1 FROM public.conversation_flows WHERE audience = v_source.audience),
    false, NULL, v_source.strong_fit_threshold, v_source.review_threshold, 'draft', v_source.id
  );

  CREATE TEMP TABLE _node_map (old_id uuid, new_id uuid) ON COMMIT DROP;
  CREATE TEMP TABLE _option_map (old_id uuid, new_id uuid) ON COMMIT DROP;

  INSERT INTO _node_map (old_id, new_id)
  SELECT id, gen_random_uuid() FROM public.flow_nodes WHERE flow_id = p_flow_id;

  INSERT INTO public.flow_nodes (
    id, flow_id, node_key, prompt, helper_text, node_type, allow_skip,
    allow_free_text, free_text_label, sort_order, default_next_node_id
  )
  SELECT m.new_id, v_draft_id, n.node_key, n.prompt, n.helper_text, n.node_type,
         n.allow_skip, n.allow_free_text, n.free_text_label, n.sort_order,
         (SELECT d.new_id FROM _node_map d WHERE d.old_id = n.default_next_node_id)
  FROM public.flow_nodes n
  JOIN _node_map m ON m.old_id = n.id
  WHERE n.flow_id = p_flow_id;

  INSERT INTO _option_map (old_id, new_id)
  SELECT o.id, gen_random_uuid()
  FROM public.flow_options o
  JOIN _node_map m ON m.old_id = o.node_id;

  INSERT INTO public.flow_options (
    id, node_id, label, value, sort_order, score_weight, trait_tag, trait_weights, next_node_id
  )
  SELECT om.new_id,
         (SELECT nm.new_id FROM _node_map nm WHERE nm.old_id = o.node_id),
         o.label, o.value, o.sort_order, o.score_weight, o.trait_tag, o.trait_weights,
         (SELECT nm.new_id FROM _node_map nm WHERE nm.old_id = o.next_node_id)
  FROM public.flow_options o
  JOIN _option_map om ON om.old_id = o.id;

  UPDATE public.conversation_flows
  SET entry_node_id = (SELECT new_id FROM _node_map WHERE old_id = v_source.entry_node_id)
  WHERE id = v_draft_id;

  DROP TABLE _node_map;
  DROP TABLE _option_map;

  RETURN v_draft_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_flow_draft(p_draft_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_draft public.conversation_flows%ROWTYPE;
BEGIN
  IF NOT (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised to publish conversations';
  END IF;

  SELECT * INTO v_draft FROM public.conversation_flows WHERE id = p_draft_id AND status = 'draft';
  IF v_draft.id IS NULL THEN
    RAISE EXCEPTION 'Draft not found';
  END IF;

  UPDATE public.conversation_flows
  SET status = 'archived', is_active = false
  WHERE audience = v_draft.audience AND status = 'published';

  UPDATE public.conversation_flows
  SET status = 'published', is_active = true, published_at = now(), draft_of = NULL
  WHERE id = p_draft_id;

  RETURN p_draft_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.discard_flow_draft(p_draft_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised to edit conversations';
  END IF;

  DELETE FROM public.flow_options o
  USING public.flow_nodes n
  WHERE o.node_id = n.id AND n.flow_id = p_draft_id;

  UPDATE public.conversation_flows SET entry_node_id = NULL WHERE id = p_draft_id;
  UPDATE public.flow_nodes SET default_next_node_id = NULL WHERE flow_id = p_draft_id;
  DELETE FROM public.flow_nodes WHERE flow_id = p_draft_id;
  DELETE FROM public.conversation_flows WHERE id = p_draft_id AND status = 'draft';
END;
$$;

REVOKE ALL ON FUNCTION public.create_flow_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_flow_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.discard_flow_draft(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_flow_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_flow_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discard_flow_draft(uuid) TO authenticated;