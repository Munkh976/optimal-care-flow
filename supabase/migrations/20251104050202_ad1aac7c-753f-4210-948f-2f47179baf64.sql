-- Update existing shifts with invalid durations to 4 hours
UPDATE shifts 
SET duration_hours = 4
WHERE duration_hours NOT IN (2, 3, 4);

-- Add check constraint for shift duration to only allow 2, 3, or 4 hours
ALTER TABLE shifts 
ADD CONSTRAINT check_duration_hours 
CHECK (duration_hours IN (2, 3, 4));