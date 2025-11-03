-- Add order_title field to shifts table
ALTER TABLE public.shifts 
ADD COLUMN order_title TEXT NOT NULL DEFAULT 'Care Service Order';