-- Fix foreign key constraint to point to care_types instead of care_needs
ALTER TABLE client_care_needs 
  DROP CONSTRAINT IF EXISTS client_care_needs_care_need_code_fkey;

ALTER TABLE client_care_needs
  ADD CONSTRAINT client_care_needs_care_need_code_fkey 
  FOREIGN KEY (care_need_code) 
  REFERENCES care_types(code) 
  ON DELETE CASCADE;