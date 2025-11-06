-- Add keywords column to care_types if it doesn't exist
ALTER TABLE care_types ADD COLUMN IF NOT EXISTS keywords text;