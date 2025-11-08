-- Create agency table
CREATE TABLE public.agency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on agency table
ALTER TABLE public.agency ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view agencies
CREATE POLICY "Authenticated users can view agencies"
ON public.agency
FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage agencies
CREATE POLICY "Admins can manage agencies"
ON public.agency
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role));

-- Insert the caremuch agency with specific ID
INSERT INTO public.agency (id, agency_name)
VALUES ('56fbfe38-e8eb-40c1-ba27-07428f62ed2e', 'caremuch');

-- Add agency_id column to profiles table (nullable first)
ALTER TABLE public.profiles
ADD COLUMN agency_id UUID REFERENCES public.agency(id);

-- Update existing profiles to set agency_id to the caremuch agency
UPDATE public.profiles
SET agency_id = '56fbfe38-e8eb-40c1-ba27-07428f62ed2e';

-- Make agency_id non-nullable
ALTER TABLE public.profiles
ALTER COLUMN agency_id SET NOT NULL;

-- Drop agency_name column from profiles
ALTER TABLE public.profiles
DROP COLUMN agency_name;

-- Add trigger for updated_at on agency table
CREATE TRIGGER update_agency_updated_at
  BEFORE UPDATE ON public.agency
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();