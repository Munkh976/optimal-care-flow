-- Update app_role enum to include caregiver and system_admin
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'caregiver';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'system_admin';

-- Create caregiver_registrations table for self-registration and approval workflow
CREATE TABLE IF NOT EXISTS public.caregiver_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  certifications TEXT[],
  skills TEXT[],
  employment_type TEXT DEFAULT 'full_time',
  hourly_rate NUMERIC,
  availability JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  agency_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on caregiver_registrations
ALTER TABLE public.caregiver_registrations ENABLE ROW LEVEL SECURITY;

-- Managers and admins can view registrations for their agency
CREATE POLICY "Managers can view caregiver registrations"
ON public.caregiver_registrations
FOR SELECT
USING (
  agency_id = auth.uid() OR
  has_role(auth.uid(), 'system_admin')
);

-- Managers and admins can update registrations (approve/reject)
CREATE POLICY "Managers can update caregiver registrations"
ON public.caregiver_registrations
FOR UPDATE
USING (
  agency_id = auth.uid() OR
  has_role(auth.uid(), 'system_admin')
);

-- Anyone can create a registration (self-registration)
CREATE POLICY "Anyone can create caregiver registration"
ON public.caregiver_registrations
FOR INSERT
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_caregiver_registrations_updated_at
BEFORE UPDATE ON public.caregiver_registrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample shift trade data
INSERT INTO public.shift_trades (shift_assignment_id, original_caregiver_id, new_caregiver_id, reason, status, trade_type, surge_pay_amount)
SELECT 
  sa.id,
  sa.caregiver_id,
  NULL,
  CASE 
    WHEN random() < 0.3 THEN 'Family emergency'
    WHEN random() < 0.5 THEN 'Medical appointment'
    WHEN random() < 0.7 THEN 'Personal matter'
    ELSE 'Schedule conflict'
  END,
  CASE 
    WHEN random() < 0.6 THEN 'pending'::trade_status
    WHEN random() < 0.8 THEN 'accepted'::trade_status
    ELSE 'declined'::trade_status
  END,
  CASE 
    WHEN random() < 0.7 THEN 'trade_board'::trade_type
    WHEN random() < 0.9 THEN 'direct_trade'::trade_type
    ELSE 'agency_coverage'::trade_type
  END,
  CASE 
    WHEN random() < 0.3 THEN FLOOR(random() * 10 + 5)::numeric
    ELSE 0
  END
FROM public.shift_assignments sa
WHERE NOT EXISTS (
  SELECT 1 FROM public.shift_trades st WHERE st.shift_assignment_id = sa.id
)
LIMIT 10;