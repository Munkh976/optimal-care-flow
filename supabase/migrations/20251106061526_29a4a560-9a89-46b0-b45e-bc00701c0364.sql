-- Add duration_hours to care_needs table
ALTER TABLE care_needs 
ADD COLUMN duration_hours numeric DEFAULT 1.0;

COMMENT ON COLUMN care_needs.duration_hours IS 'Default duration in hours for this care need type';