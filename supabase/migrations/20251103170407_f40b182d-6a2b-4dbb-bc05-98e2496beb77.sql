-- Create caregiver_skills junction table
CREATE TABLE public.caregiver_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id uuid REFERENCES public.caregivers(id) ON DELETE CASCADE NOT NULL,
    care_type_code text REFERENCES public.care_types(code) NOT NULL,
    proficiency_level text DEFAULT 'intermediate',
    years_experience integer DEFAULT 0,
    is_certified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(caregiver_id, care_type_code)
);

-- Enable RLS
ALTER TABLE public.caregiver_skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Agency users can manage caregiver skills"
ON public.caregiver_skills FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.caregivers
    WHERE caregivers.id = caregiver_skills.caregiver_id
    AND caregivers.agency_id = auth.uid()
  )
);

-- Drop old skills and certifications columns from caregivers
ALTER TABLE public.caregivers DROP COLUMN IF EXISTS skills;
ALTER TABLE public.caregivers DROP COLUMN IF EXISTS certifications;

-- Drop old certifications column from caregiver_registrations (we have caregiver_certifications table)
ALTER TABLE public.caregiver_registrations DROP COLUMN IF EXISTS certifications;
ALTER TABLE public.caregiver_registrations DROP COLUMN IF EXISTS skills;

-- Sample data: Add some caregiver skills (adjust caregiver_id as needed based on your actual caregivers)
-- This is just structure - you'll add real data through the UI
INSERT INTO public.caregiver_skills (caregiver_id, care_type_code, proficiency_level, years_experience, is_certified)
SELECT 
  c.id,
  'CT002',
  'expert',
  5,
  true
FROM public.caregivers c
LIMIT 1
ON CONFLICT (caregiver_id, care_type_code) DO NOTHING;