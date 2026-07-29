ALTER TABLE public.flow_nodes
  ADD COLUMN IF NOT EXISTS dynamic_source_table text,
  ADD COLUMN IF NOT EXISTS default_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sub_question_template text;

ALTER TABLE public.care_service_categories
  ADD COLUMN IF NOT EXISTS weight_overrides jsonb;

ALTER TABLE public.care_types
  ADD COLUMN IF NOT EXISTS weight_overrides jsonb;

ALTER TABLE public.conversation_answers
  ADD COLUMN IF NOT EXISTS dynamic_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  weight_overrides jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.certifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certifications TO authenticated;
GRANT ALL ON public.certifications TO service_role;

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active certifications"
  ON public.certifications FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Staff can view certifications"
  ON public.certifications FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins and managers can manage certifications"
  ON public.certifications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_certifications_updated_at
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.certifications (name, sort_order) VALUES
  ('CNA (Certified Nursing Assistant)', 10),
  ('HHA (Home Health Aide)', 20),
  ('CPR / First Aid', 30),
  ('Dementia care training', 40),
  ('Medication administration', 50),
  ('None yet', 60)
ON CONFLICT (name) DO NOTHING;