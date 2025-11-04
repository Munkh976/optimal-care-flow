-- Drop the old care_type enum column and add care_type_code text column
ALTER TABLE shifts DROP COLUMN IF EXISTS care_type;

-- Add care_type_code column that references care_types (nullable first)
ALTER TABLE shifts ADD COLUMN care_type_code text;

-- Get the first care type code from care_types table and update all existing shifts
-- This assumes you have at least one care type in the care_types table
UPDATE shifts 
SET care_type_code = (SELECT code FROM care_types LIMIT 1)
WHERE care_type_code IS NULL;

-- Add foreign key constraint
ALTER TABLE shifts ADD CONSTRAINT shifts_care_type_code_fkey 
  FOREIGN KEY (care_type_code) REFERENCES care_types(code);

-- Now make care_type_code required (not null)
ALTER TABLE shifts ALTER COLUMN care_type_code SET NOT NULL;

-- Update caregiver_skills foreign key if not already present
ALTER TABLE caregiver_skills DROP CONSTRAINT IF EXISTS caregiver_skills_care_type_code_fkey;
ALTER TABLE caregiver_skills ADD CONSTRAINT caregiver_skills_care_type_code_fkey 
  FOREIGN KEY (care_type_code) REFERENCES care_types(code);