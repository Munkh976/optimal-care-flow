-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('system_admin', 'agency_admin', 'manager', 'scheduler', 'hr_staff', 'caregiver');

-- Create user_roles table (CRITICAL: separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  agency_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'system_admin' THEN 1
    WHEN 'agency_admin' THEN 2
    WHEN 'manager' THEN 3
    WHEN 'scheduler' THEN 4
    WHEN 'hr_staff' THEN 5
    WHEN 'caregiver' THEN 6
  END
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'system_admin') OR public.has_role(auth.uid(), 'agency_admin'));

-- Create request_type enum
CREATE TYPE public.request_type AS ENUM ('vacation', 'medical', 'personal', 'emergency');

-- Create request_status enum
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'denied', 'cancelled');

-- Create time_off_requests table
CREATE TABLE public.time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID REFERENCES public.caregivers(id) ON DELETE CASCADE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  request_type request_type NOT NULL,
  status request_status DEFAULT 'pending' NOT NULL,
  approved_by_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on time_off_requests
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for time_off_requests
CREATE POLICY "Caregivers can view their own time off requests"
  ON public.time_off_requests FOR SELECT
  USING (
    caregiver_id IN (
      SELECT id FROM public.caregivers WHERE agency_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view time off requests"
  ON public.time_off_requests FOR SELECT
  USING (
    public.has_role(auth.uid(), 'manager') OR 
    public.has_role(auth.uid(), 'agency_admin') OR
    public.has_role(auth.uid(), 'scheduler')
  );

CREATE POLICY "Caregivers can create time off requests"
  ON public.time_off_requests FOR INSERT
  WITH CHECK (
    caregiver_id IN (
      SELECT id FROM public.caregivers WHERE agency_id = auth.uid()
    )
  );

CREATE POLICY "Managers can update time off requests"
  ON public.time_off_requests FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'manager') OR 
    public.has_role(auth.uid(), 'agency_admin')
  );

-- Create assignment_status enum
CREATE TYPE public.assignment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'no_show', 'cancelled');

-- Create assignment_method enum
CREATE TYPE public.assignment_method AS ENUM ('manual', 'ai_suggested', 'auto_assigned', 'traded', 'picked_up');

-- Create shift_assignments table
CREATE TABLE public.shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
  caregiver_id UUID REFERENCES public.caregivers(id) ON DELETE CASCADE NOT NULL,
  status assignment_status DEFAULT 'scheduled' NOT NULL,
  is_locked BOOLEAN DEFAULT true,
  clock_in_time TIMESTAMP WITH TIME ZONE,
  clock_in_location TEXT,
  clock_out_time TIMESTAMP WITH TIME ZONE,
  clock_out_location TEXT,
  actual_hours_worked NUMERIC,
  mileage NUMERIC,
  notes TEXT,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assignment_method assignment_method DEFAULT 'manual' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on shift_assignments
ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for shift_assignments
CREATE POLICY "Agency users can manage shift assignments"
  ON public.shift_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shifts
      WHERE shifts.id = shift_assignments.shift_id
      AND shifts.agency_id = auth.uid()
    )
  );

-- Create trade_status enum
CREATE TYPE public.trade_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'expired');

-- Create trade_type enum
CREATE TYPE public.trade_type AS ENUM ('trade_board', 'direct_trade', 'agency_coverage');

-- Create shift_trades table
CREATE TABLE public.shift_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_assignment_id UUID REFERENCES public.shift_assignments(id) ON DELETE CASCADE NOT NULL,
  original_caregiver_id UUID REFERENCES public.caregivers(id) NOT NULL,
  new_caregiver_id UUID REFERENCES public.caregivers(id),
  reason TEXT,
  status trade_status DEFAULT 'pending' NOT NULL,
  trade_type trade_type DEFAULT 'trade_board' NOT NULL,
  surge_pay_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on shift_trades
ALTER TABLE public.shift_trades ENABLE ROW LEVEL SECURITY;

-- RLS policies for shift_trades
CREATE POLICY "Agency users can view shift trades"
  ON public.shift_trades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.caregivers
      WHERE caregivers.id = shift_trades.original_caregiver_id
      AND caregivers.agency_id = auth.uid()
    )
  );

CREATE POLICY "Caregivers can create shift trades"
  ON public.shift_trades FOR INSERT
  WITH CHECK (
    original_caregiver_id IN (
      SELECT id FROM public.caregivers WHERE agency_id = auth.uid()
    )
  );

CREATE POLICY "Agency users can update shift trades"
  ON public.shift_trades FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.caregivers
      WHERE caregivers.id = shift_trades.original_caregiver_id
      AND caregivers.agency_id = auth.uid()
    )
  );

-- Create caregiver_certifications table
CREATE TABLE public.caregiver_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID REFERENCES public.caregivers(id) ON DELETE CASCADE NOT NULL,
  certification_name TEXT NOT NULL,
  certification_number TEXT,
  issued_date DATE,
  expiry_date DATE NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  document_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on caregiver_certifications
ALTER TABLE public.caregiver_certifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for caregiver_certifications
CREATE POLICY "Agency users can manage certifications"
  ON public.caregiver_certifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.caregivers
      WHERE caregivers.id = caregiver_certifications.caregiver_id
      AND caregivers.agency_id = auth.uid()
    )
  );

-- Create caregiver_availability table
CREATE TABLE public.caregiver_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID REFERENCES public.caregivers(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(caregiver_id, day_of_week)
);

-- Enable RLS on caregiver_availability
ALTER TABLE public.caregiver_availability ENABLE ROW LEVEL SECURITY;

-- RLS policies for caregiver_availability
CREATE POLICY "Agency users can manage availability"
  ON public.caregiver_availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.caregivers
      WHERE caregivers.id = caregiver_availability.caregiver_id
      AND caregivers.agency_id = auth.uid()
    )
  );

-- Add new columns to caregivers table
ALTER TABLE public.caregivers
ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'on_call')) DEFAULT 'full_time',
ADD COLUMN IF NOT EXISTS custom_min_hours INTEGER,
ADD COLUMN IF NOT EXISTS reliability_score INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS performance_rating NUMERIC DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS hire_date DATE;

-- Add new columns to shifts table
ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS pay_rate NUMERIC,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT,
ADD COLUMN IF NOT EXISTS special_notes TEXT;

-- Update shift status enum to include new statuses
ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'unassigned';
ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'in_progress';

-- Add agency settings to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_license TEXT,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')) DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS default_ft_min_hours INTEGER DEFAULT 35,
ADD COLUMN IF NOT EXISTS default_pt_min_hours INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS overtime_threshold INTEGER DEFAULT 40;

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_time_off_requests_updated_at
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shift_assignments_updated_at
  BEFORE UPDATE ON public.shift_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caregiver_certifications_updated_at
  BEFORE UPDATE ON public.caregiver_certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caregiver_availability_updated_at
  BEFORE UPDATE ON public.caregiver_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();