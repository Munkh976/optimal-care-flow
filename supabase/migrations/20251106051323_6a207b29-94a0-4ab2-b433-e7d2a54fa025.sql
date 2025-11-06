-- Add service zipcodes array to caregivers table
ALTER TABLE caregivers 
ADD COLUMN IF NOT EXISTS service_zipcodes text[] DEFAULT '{}';

COMMENT ON COLUMN caregivers.service_zipcodes IS 'Array of zip codes where the caregiver provides services';