-- Add location fields to caregivers table
ALTER TABLE caregivers 
ADD COLUMN IF NOT EXISTS location_address text,
ADD COLUMN IF NOT EXISTS location_city text,
ADD COLUMN IF NOT EXISTS location_state text,
ADD COLUMN IF NOT EXISTS location_zip_code text,
ADD COLUMN IF NOT EXISTS service_radius_miles integer DEFAULT 10;