
-- Remove old constraint
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS check_duration_hours;

-- Add new constraint that allows 2, 3, 4, and 8 hour shifts
ALTER TABLE public.shifts ADD CONSTRAINT check_duration_hours 
CHECK (duration_hours IN (2, 3, 4, 8));
