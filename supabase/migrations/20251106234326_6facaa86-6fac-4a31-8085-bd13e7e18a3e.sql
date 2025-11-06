-- Add duration_hours column to care_types table
ALTER TABLE public.care_types
ADD COLUMN duration_hours numeric DEFAULT 4.0;