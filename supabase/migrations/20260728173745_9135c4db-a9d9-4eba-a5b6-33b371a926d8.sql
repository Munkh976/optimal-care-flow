-- 1. Allow code renames to cascade to dependent records
ALTER TABLE public.shifts DROP CONSTRAINT shifts_care_type_code_fkey;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_care_type_code_fkey
  FOREIGN KEY (care_type_code) REFERENCES public.care_types(code) ON UPDATE CASCADE;

ALTER TABLE public.caregiver_skills DROP CONSTRAINT caregiver_skills_care_type_code_fkey;
ALTER TABLE public.caregiver_skills ADD CONSTRAINT caregiver_skills_care_type_code_fkey
  FOREIGN KEY (care_type_code) REFERENCES public.care_types(code) ON UPDATE CASCADE;

ALTER TABLE public.client_care_needs DROP CONSTRAINT client_care_needs_care_type_code_fkey;
ALTER TABLE public.client_care_needs ADD CONSTRAINT client_care_needs_care_type_code_fkey
  FOREIGN KEY (care_type_code) REFERENCES public.care_types(code) ON UPDATE CASCADE;

-- 2. Normalize the legacy codes
UPDATE public.care_types SET code = 'ADL0003' WHERE code = 'COMPANIONSHIP';
UPDATE public.care_types SET code = 'ADL0004' WHERE code = 'MEAL_PREP';
UPDATE public.care_types SET code = 'HMC0001' WHERE code = 'MEDICATION_MGMT';
UPDATE public.care_types SET code = 'SAF0001' WHERE code = 'MOBILITY_ASSIST';
UPDATE public.care_types SET code = 'SPC0001' WHERE code = 'PERSONAL_CARE';

-- 3. Care service categories
CREATE TABLE public.care_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code_prefix text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_service_categories TO authenticated;
GRANT ALL ON public.care_service_categories TO service_role;

ALTER TABLE public.care_service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view care service categories"
  ON public.care_service_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage care service categories"
  ON public.care_service_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'));

CREATE TRIGGER update_care_service_categories_updated_at
  BEFORE UPDATE ON public.care_service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.care_service_categories (name, code_prefix, sort_order) VALUES
  ('Activities of Daily Living (ADL)', 'ADL', 1),
  ('Instrumental Activities of Daily Living (IADL)', 'IADL', 2),
  ('Health Monitoring & Care', 'HMC', 3),
  ('Cognitive & Emotional Support', 'CES', 4),
  ('Safety & Transportation', 'SAF', 5),
  ('Specialized Care', 'SPC', 6)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.care_service_categories (name, sort_order)
SELECT DISTINCT ct.category, 99 FROM public.care_types ct
WHERE ct.category IS NOT NULL AND ct.category <> ''
ON CONFLICT (name) DO NOTHING;

-- 4. Menu label
UPDATE public.system_modules SET module_name = 'Care Services' WHERE module_code = 'care_types';