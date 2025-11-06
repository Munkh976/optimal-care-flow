-- Fix RLS policies to allow caregivers to manage their own availability
DROP POLICY IF EXISTS "Agency users can manage availability" ON caregiver_availability;
DROP POLICY IF EXISTS "Agency users can manage caregiver skills" ON caregiver_skills;

-- Allow caregivers to view and manage their own availability
CREATE POLICY "Caregivers can manage their own availability"
ON caregiver_availability
FOR ALL
USING (
  caregiver_id IN (
    SELECT id FROM caregivers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  caregiver_id IN (
    SELECT id FROM caregivers WHERE user_id = auth.uid()
  )
);

-- Allow agency users to manage availability
CREATE POLICY "Agency users can manage caregiver availability"
ON caregiver_availability
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM caregivers
    WHERE caregivers.id = caregiver_availability.caregiver_id
    AND caregivers.agency_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM caregivers
    WHERE caregivers.id = caregiver_availability.caregiver_id
    AND caregivers.agency_id = auth.uid()
  )
);

-- Allow caregivers to view and manage their own skills
CREATE POLICY "Caregivers can manage their own skills"
ON caregiver_skills
FOR ALL
USING (
  caregiver_id IN (
    SELECT id FROM caregivers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  caregiver_id IN (
    SELECT id FROM caregivers WHERE user_id = auth.uid()
  )
);

-- Allow agency users to manage caregiver skills
CREATE POLICY "Agency users can manage caregiver skills"
ON caregiver_skills
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM caregivers
    WHERE caregivers.id = caregiver_skills.caregiver_id
    AND caregivers.agency_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM caregivers
    WHERE caregivers.id = caregiver_skills.caregiver_id
    AND caregivers.agency_id = auth.uid()
  )
);