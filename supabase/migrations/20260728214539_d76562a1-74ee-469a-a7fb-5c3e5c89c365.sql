
CREATE TYPE public.flow_audience AS ENUM ('caregiver_screening', 'family_intake', 'general');
CREATE TYPE public.flow_node_type AS ENUM ('single_select', 'multi_select', 'info', 'contact_capture', 'terminal');
CREATE TYPE public.conversation_session_status AS ENUM ('in_progress', 'completed', 'abandoned');

CREATE TABLE public.conversation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid,
  audience public.flow_audience NOT NULL DEFAULT 'general',
  name text NOT NULL,
  description text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  entry_node_id uuid,
  strong_fit_threshold numeric NOT NULL DEFAULT 70,
  review_threshold numeric NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conversation_flows TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_flows TO authenticated;
GRANT ALL ON public.conversation_flows TO service_role;
ALTER TABLE public.conversation_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active flows" ON public.conversation_flows
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage flows" ON public.conversation_flows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'));

CREATE TABLE public.flow_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
  node_key text NOT NULL,
  prompt text NOT NULL,
  helper_text text,
  node_type public.flow_node_type NOT NULL DEFAULT 'single_select',
  allow_skip boolean NOT NULL DEFAULT true,
  allow_free_text boolean NOT NULL DEFAULT false,
  free_text_label text,
  sort_order integer NOT NULL DEFAULT 0,
  default_next_node_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flow_id, node_key)
);
ALTER TABLE public.flow_nodes
  ADD CONSTRAINT flow_nodes_default_next_fkey
  FOREIGN KEY (default_next_node_id) REFERENCES public.flow_nodes(id) ON DELETE SET NULL;
ALTER TABLE public.conversation_flows
  ADD CONSTRAINT conversation_flows_entry_node_fkey
  FOREIGN KEY (entry_node_id) REFERENCES public.flow_nodes(id) ON DELETE SET NULL;
GRANT SELECT ON public.flow_nodes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_nodes TO authenticated;
GRANT ALL ON public.flow_nodes TO service_role;
ALTER TABLE public.flow_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read nodes of active flows" ON public.flow_nodes
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.conversation_flows f WHERE f.id = flow_id AND f.is_active));
CREATE POLICY "Admins manage nodes" ON public.flow_nodes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'));

CREATE TABLE public.flow_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  score_weight numeric NOT NULL DEFAULT 0,
  trait_tag text,
  next_node_id uuid REFERENCES public.flow_nodes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.flow_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_options TO authenticated;
GRANT ALL ON public.flow_options TO service_role;
ALTER TABLE public.flow_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read options of active flows" ON public.flow_options
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.flow_nodes n
    JOIN public.conversation_flows f ON f.id = n.flow_id
    WHERE n.id = node_id AND f.is_active));
CREATE POLICY "Admins manage options" ON public.flow_options
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'));

CREATE TABLE public.conversation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.conversation_flows(id) ON DELETE CASCADE,
  agency_id uuid,
  user_id uuid,
  session_token text NOT NULL UNIQUE,
  status public.conversation_session_status NOT NULL DEFAULT 'in_progress',
  current_node_id uuid REFERENCES public.flow_nodes(id) ON DELETE SET NULL,
  total_score numeric NOT NULL DEFAULT 0,
  trait_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  band text,
  contact_name text,
  contact_email text,
  contact_phone text,
  registration_id uuid REFERENCES public.caregiver_registrations(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.conversation_sessions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.conversation_sessions TO authenticated;
GRANT ALL ON public.conversation_sessions TO service_role;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can start a session" ON public.conversation_sessions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Session holder can update own session" ON public.conversation_sessions
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Staff can read agency sessions" ON public.conversation_sessions
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'system_admin')
    OR public.has_role(auth.uid(), 'agency_admin')
    OR public.has_role(auth.uid(), 'manager')
    OR user_id = auth.uid()
  );

CREATE TABLE public.conversation_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
  node_id uuid NOT NULL REFERENCES public.flow_nodes(id) ON DELETE CASCADE,
  option_ids uuid[] NOT NULL DEFAULT '{}',
  option_labels text[] NOT NULL DEFAULT '{}',
  free_text text,
  skipped boolean NOT NULL DEFAULT false,
  score_delta numeric NOT NULL DEFAULT 0,
  sequence_index integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  answered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.conversation_answers TO anon;
GRANT SELECT, INSERT, UPDATE ON public.conversation_answers TO authenticated;
GRANT ALL ON public.conversation_answers TO service_role;
ALTER TABLE public.conversation_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record answers" ON public.conversation_answers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Answers can be trimmed by session holder" ON public.conversation_answers
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Staff can read answers" ON public.conversation_answers
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'system_admin')
    OR public.has_role(auth.uid(), 'agency_admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE INDEX idx_flow_nodes_flow ON public.flow_nodes(flow_id, sort_order);
CREATE INDEX idx_flow_options_node ON public.flow_options(node_id, sort_order);
CREATE INDEX idx_conv_answers_session ON public.conversation_answers(session_id, sequence_index);
CREATE INDEX idx_conv_sessions_flow ON public.conversation_sessions(flow_id, status);

CREATE TRIGGER trg_conversation_flows_updated BEFORE UPDATE ON public.conversation_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_flow_nodes_updated BEFORE UPDATE ON public.flow_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_flow_options_updated BEFORE UPDATE ON public.flow_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_conversation_sessions_updated BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_conversation_answers_updated BEFORE UPDATE ON public.conversation_answers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
