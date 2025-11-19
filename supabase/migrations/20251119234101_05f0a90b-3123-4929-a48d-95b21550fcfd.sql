-- Fix RLS for caregiver_availability: agency users should match by profiles.agency_id, not auth.uid() = agency_id
ALTER POLICY "Agency users can manage caregiver availability"
ON public.caregiver_availability
USING (
  EXISTS (
    SELECT 1
    FROM caregivers c
    JOIN profiles p ON p.agency_id = c.agency_id
    WHERE c.id = caregiver_availability.caregiver_id
      AND p.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM caregivers c
    JOIN profiles p ON p.agency_id = c.agency_id
    WHERE c.id = caregiver_availability.caregiver_id
      AND p.id = auth.uid()
  )
);

-- Fix RLS for caregiver_skills similarly
ALTER POLICY "Agency users can manage caregiver skills"
ON public.caregiver_skills
USING (
  EXISTS (
    SELECT 1
    FROM caregivers c
    JOIN profiles p ON p.agency_id = c.agency_id
    WHERE c.id = caregiver_skills.caregiver_id
      AND p.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM caregivers c
    JOIN profiles p ON p.agency_id = c.agency_id
    WHERE c.id = caregiver_skills.caregiver_id
      AND p.id = auth.uid()
  )
);