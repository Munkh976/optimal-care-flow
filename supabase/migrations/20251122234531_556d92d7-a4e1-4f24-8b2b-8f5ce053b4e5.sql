-- WARNING: This will reset your entire database and load sample data
-- All existing data will be lost

-- First, drop existing tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.shift_trades CASCADE;
DROP TABLE IF EXISTS public.shift_assignments CASCADE;
DROP TABLE IF EXISTS public.time_off_requests CASCADE;
DROP TABLE IF EXISTS public.client_care_needs CASCADE;
DROP TABLE IF EXISTS public.caregiver_skills CASCADE;
DROP TABLE IF EXISTS public.caregiver_certifications CASCADE;
DROP TABLE IF EXISTS public.caregiver_availability CASCADE;
DROP TABLE IF EXISTS public.caregiver_registrations CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.client_orders CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.caregivers CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.care_types CASCADE;
DROP TABLE IF EXISTS public.system_modules CASCADE;
DROP TABLE IF EXISTS public.system_roles CASCADE;
DROP TABLE IF EXISTS public.agency CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS public.order_number_seq CASCADE;

-- Recreate agency table with sample data
CREATE TABLE public.agency (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  naics_code text,
  agency_name text NOT NULL,
  business_type text,
  tax_id text,
  address text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  website text
);

ALTER TABLE public.agency ENABLE ROW LEVEL SECURITY;

-- Insert system agency and sample agencies
INSERT INTO public.agency (id, agency_name, business_type, address, city, state, zip_code, phone, email, is_active) VALUES
('00000000-0000-0000-0000-000000000000', 'System Agency', 'System', 'System', 'System', 'CA', '00000', '000-000-0000', 'system@carematch.com', true),
('56fbfe38-e8eb-40c1-ba27-07428f62ed2e', 'CareMuch Agency', 'Home Care', '123 Care Street', 'Los Angeles', 'CA', '90001', '310-555-0100', 'info@caremuch.com', true);

-- Recreate care_types table
CREATE TABLE public.care_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  category text NOT NULL,
  name text NOT NULL,
  description text,
  keywords text,
  price numeric DEFAULT 35.00,
  duration_hours numeric DEFAULT 4.0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.care_types ENABLE ROW LEVEL SECURITY;

-- Insert sample care types
INSERT INTO public.care_types (code, category, name, description, price, duration_hours, is_active) VALUES
('PERSONAL_CARE', 'Basic Care', 'Personal Care', 'Assistance with bathing, dressing, grooming', 35.00, 4.0, true),
('COMPANIONSHIP', 'Basic Care', 'Companionship', 'Social interaction and emotional support', 30.00, 4.0, true),
('MEAL_PREP', 'Daily Living', 'Meal Preparation', 'Planning and preparing nutritious meals', 32.00, 2.0, true),
('MEDICATION_MGMT', 'Medical Support', 'Medication Management', 'Medication reminders and administration', 40.00, 1.0, true),
('MOBILITY_ASSIST', 'Physical Care', 'Mobility Assistance', 'Help with walking, transfers, exercise', 38.00, 3.0, true);

-- Recreate profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  phone text,
  agency_id uuid NOT NULL REFERENCES public.agency(id),
  business_license text,
  subscription_tier text DEFAULT 'starter',
  default_ft_min_hours integer DEFAULT 35,
  default_pt_min_hours integer DEFAULT 15,
  overtime_threshold integer DEFAULT 40,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Recreate system_roles table
CREATE TABLE public.system_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_code app_role NOT NULL UNIQUE,
  role_name text NOT NULL,
  description text,
  access_level integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;

-- Insert sample system roles
INSERT INTO public.system_roles (role_code, role_name, description, access_level) VALUES
('system_admin', 'System Administrator', 'Full system access', 100),
('agency_admin', 'Agency Administrator', 'Full agency access', 90),
('manager', 'Manager', 'Agency operations management', 70),
('scheduler', 'Scheduler', 'Schedule and shift management', 50),
('hr_staff', 'HR Staff', 'Human resources operations', 40),
('caregiver', 'Caregiver', 'Direct care provider', 20),
('client', 'Client', 'Care recipient', 10);

-- Recreate system_modules table
CREATE TABLE public.system_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_code text NOT NULL UNIQUE,
  module_name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;

-- Insert sample system modules
INSERT INTO public.system_modules (module_code, module_name, description, category) VALUES
('dashboard', 'Dashboard', 'Main dashboard view', 'core'),
('users', 'User Management', 'Manage system users', 'administration'),
('caregivers', 'Caregiver Management', 'Manage caregivers', 'operations'),
('clients', 'Client Management', 'Manage clients', 'operations'),
('schedule', 'Schedule Management', 'Manage shifts and schedules', 'operations'),
('orders', 'Order Management', 'Manage client orders', 'operations'),
('reports', 'Reports', 'View and generate reports', 'analytics'),
('settings', 'Settings', 'System and agency settings', 'administration');

-- Recreate user_roles table
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL,
  agency_id uuid REFERENCES public.agency(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Recreate role_permissions table
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_code app_role NOT NULL,
  module_code text NOT NULL REFERENCES public.system_modules(module_code),
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(role_code, module_code)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Insert default permissions
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete) VALUES
-- System Admin - full access
('system_admin', 'dashboard', true, true, true, true),
('system_admin', 'users', true, true, true, true),
('system_admin', 'caregivers', true, true, true, true),
('system_admin', 'clients', true, true, true, true),
('system_admin', 'schedule', true, true, true, true),
('system_admin', 'orders', true, true, true, true),
('system_admin', 'reports', true, true, true, true),
('system_admin', 'settings', true, true, true, true),
-- Agency Admin
('agency_admin', 'dashboard', false, true, false, false),
('agency_admin', 'users', true, true, true, true),
('agency_admin', 'caregivers', true, true, true, true),
('agency_admin', 'clients', true, true, true, true),
('agency_admin', 'schedule', true, true, true, true),
('agency_admin', 'orders', true, true, true, true),
('agency_admin', 'reports', false, true, false, false),
('agency_admin', 'settings', false, true, true, false),
-- Manager
('manager', 'dashboard', false, true, false, false),
('manager', 'caregivers', true, true, true, false),
('manager', 'clients', true, true, true, false),
('manager', 'schedule', true, true, true, true),
('manager', 'orders', true, true, true, false),
('manager', 'reports', false, true, false, false),
-- Scheduler
('scheduler', 'dashboard', false, true, false, false),
('scheduler', 'caregivers', false, true, false, false),
('scheduler', 'clients', false, true, false, false),
('scheduler', 'schedule', true, true, true, true),
('scheduler', 'orders', false, true, false, false),
-- Caregiver
('caregiver', 'dashboard', false, true, false, false),
('caregiver', 'schedule', false, true, false, false),
-- Client
('client', 'dashboard', false, true, false, false),
('client', 'schedule', false, true, false, false),
('client', 'orders', true, true, false, false);

-- Recreate caregivers table
CREATE TABLE public.caregivers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agency(id),
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  employment_type text DEFAULT 'full_time',
  role caregiver_role NOT NULL DEFAULT 'full_time',
  hourly_rate numeric,
  availability jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  custom_min_hours integer,
  reliability_score integer DEFAULT 100,
  performance_rating numeric DEFAULT 5.0,
  hire_date date,
  service_radius_miles integer DEFAULT 10,
  emergency_contact_name text,
  emergency_contact_phone text,
  location_address text,
  location_city text,
  location_state text,
  location_zip_code text,
  service_zipcodes text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.caregivers ENABLE ROW LEVEL SECURITY;

-- Recreate clients table
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agency(id),
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  care_requirements text[] DEFAULT '{}',
  medical_conditions text[] DEFAULT '{}',
  notes text,
  preferred_caregiver_id uuid REFERENCES public.caregivers(id),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create order number sequence
CREATE SEQUENCE public.order_number_seq START 1;

-- Recreate client_orders table
CREATE TABLE public.client_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL UNIQUE DEFAULT generate_order_number(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  agency_id uuid NOT NULL REFERENCES public.agency(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  frequency text NOT NULL DEFAULT 'once',
  days_of_week text,
  status text DEFAULT 'active',
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.client_orders ENABLE ROW LEVEL SECURITY;

-- Recreate shifts table
CREATE TABLE public.shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES public.agency(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  caregiver_id uuid REFERENCES public.caregivers(id),
  order_id uuid REFERENCES public.client_orders(id),
  order_title text NOT NULL DEFAULT 'Care Service Order',
  care_type_code text NOT NULL REFERENCES public.care_types(code),
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  duration_hours numeric NOT NULL,
  pay_rate numeric,
  status shift_status DEFAULT 'open',
  is_recurring boolean DEFAULT false,
  recurrence_pattern text,
  required_skills text[] DEFAULT '{}',
  special_instructions text,
  special_notes text,
  ai_match_score integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Recreate caregiver_availability table
CREATE TABLE public.caregiver_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.caregiver_availability ENABLE ROW LEVEL SECURITY;

-- Recreate caregiver_skills table
CREATE TABLE public.caregiver_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  care_type_code text NOT NULL REFERENCES public.care_types(code),
  years_experience integer DEFAULT 0,
  proficiency_level text DEFAULT 'intermediate',
  is_certified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.caregiver_skills ENABLE ROW LEVEL SECURITY;

-- Recreate remaining tables
CREATE TABLE public.caregiver_certifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  certification_name text NOT NULL,
  certification_number text,
  issued_date date,
  expiry_date date NOT NULL,
  document_url text,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.caregiver_certifications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_care_needs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  care_type_code text NOT NULL REFERENCES public.care_types(code),
  priority integer DEFAULT 1,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.client_care_needs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shift_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id),
  status assignment_status NOT NULL DEFAULT 'scheduled',
  assignment_method assignment_method NOT NULL DEFAULT 'manual',
  is_locked boolean DEFAULT true,
  clock_in_time timestamp with time zone,
  clock_out_time timestamp with time zone,
  clock_in_location text,
  clock_out_location text,
  actual_hours_worked numeric,
  mileage numeric,
  notes text,
  assigned_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shift_trades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_assignment_id uuid NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
  original_caregiver_id uuid NOT NULL REFERENCES public.caregivers(id),
  new_caregiver_id uuid REFERENCES public.caregivers(id),
  status trade_status NOT NULL DEFAULT 'pending',
  trade_type trade_type NOT NULL DEFAULT 'trade_board',
  surge_pay_amount numeric DEFAULT 0,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.shift_trades ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.time_off_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  request_type request_type NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  reason text,
  notes text,
  approved_by_user_id uuid REFERENCES auth.users,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.caregiver_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  phone text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  employment_type text DEFAULT 'full_time',
  hourly_rate numeric,
  availability jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  rejection_reason text,
  agency_id uuid REFERENCES public.agency(id),
  reviewed_by uuid REFERENCES auth.users,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.caregiver_registrations ENABLE ROW LEVEL SECURITY;

-- Add all RLS policies (abbreviated for key tables)
CREATE POLICY "Admins can manage agencies" ON public.agency FOR ALL USING (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role));
CREATE POLICY "Authenticated users can view agencies" ON public.agency FOR SELECT USING (true);

CREATE POLICY "Anyone authenticated can view care types" ON public.care_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage care types" ON public.care_types FOR ALL USING (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role));

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role));

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role));

CREATE POLICY "Agency users can manage their caregivers" ON public.caregivers FOR ALL USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Caregivers can view their own profile" ON public.caregivers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Caregivers can update their own profile" ON public.caregivers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Require authentication for caregiver access" ON public.caregivers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Clients view caregivers (agency scope) 20251106" ON public.caregivers FOR SELECT USING (EXISTS (SELECT 1 FROM clients cl WHERE cl.user_id = auth.uid() AND cl.agency_id = caregivers.agency_id));

CREATE POLICY "Staff can view clients" ON public.clients FOR SELECT USING ((agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())) AND (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'scheduler'::app_role) OR has_role(auth.uid(), 'hr_staff'::app_role)));
CREATE POLICY "Admins and managers can manage clients" ON public.clients FOR ALL USING ((agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())) AND (has_role(auth.uid(), 'system_admin'::app_role) OR has_role(auth.uid(), 'agency_admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));
CREATE POLICY "Clients can view their own profile" ON public.clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Clients can update their own profile" ON public.clients FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Agency users can manage their shifts" ON public.shifts FOR ALL USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Require authentication for shift access" ON public.shifts FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Caregivers can manage their own availability" ON public.caregiver_availability FOR ALL USING (caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid()));
CREATE POLICY "Agency users can manage caregiver availability" ON public.caregiver_availability FOR ALL USING (EXISTS (SELECT 1 FROM caregivers c JOIN profiles p ON p.agency_id = c.agency_id WHERE c.id = caregiver_availability.caregiver_id AND p.id = auth.uid()));
CREATE POLICY "Clients view caregiver availability (agency scope) 20251106" ON public.caregiver_availability FOR SELECT USING (EXISTS (SELECT 1 FROM caregivers c JOIN clients cl ON cl.agency_id = c.agency_id WHERE c.id = caregiver_availability.caregiver_id AND cl.user_id = auth.uid()));

CREATE POLICY "Caregivers can manage their own skills" ON public.caregiver_skills FOR ALL USING (caregiver_id IN (SELECT id FROM caregivers WHERE user_id = auth.uid()));
CREATE POLICY "Agency users can manage caregiver skills" ON public.caregiver_skills FOR ALL USING (EXISTS (SELECT 1 FROM caregivers c JOIN profiles p ON p.agency_id = c.agency_id WHERE c.id = caregiver_skills.caregiver_id AND p.id = auth.uid()));

CREATE POLICY "Agency users can manage their client orders" ON public.client_orders FOR ALL USING (agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Require authentication for client order access" ON public.client_orders FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Agency users can manage shift assignments" ON public.shift_assignments FOR ALL USING (EXISTS (SELECT 1 FROM shifts WHERE shifts.id = shift_assignments.shift_id AND shifts.agency_id = auth.uid()));
CREATE POLICY "Require authentication for shift assignment access" ON public.shift_assignments FOR ALL USING (auth.uid() IS NOT NULL);

-- Add update triggers
CREATE TRIGGER update_agency_updated_at BEFORE UPDATE ON public.agency FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_caregivers_updated_at BEFORE UPDATE ON public.caregivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_caregiver_availability_updated_at BEFORE UPDATE ON public.caregiver_availability FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_caregiver_skills_updated_at BEFORE UPDATE ON public.caregiver_skills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();