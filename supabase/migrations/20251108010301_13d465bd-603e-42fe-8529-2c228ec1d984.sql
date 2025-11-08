-- Create system_roles table to store available system roles
CREATE TABLE IF NOT EXISTS public.system_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL UNIQUE,
  role_code app_role NOT NULL UNIQUE,
  description TEXT,
  access_level INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view active system roles
CREATE POLICY "Anyone authenticated can view active system roles"
ON public.system_roles
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Only system admins can manage system roles
CREATE POLICY "System admins can manage system roles"
ON public.system_roles
FOR ALL
USING (has_role(auth.uid(), 'system_admin'::app_role));

-- Insert default system roles
INSERT INTO public.system_roles (role_name, role_code, description, access_level) VALUES
  ('System Administrator', 'system_admin', 'Full system access with all privileges', 100),
  ('Agency Administrator', 'agency_admin', 'Manage agency operations and users', 80),
  ('Manager', 'manager', 'Manage schedules, staff, and clients', 60),
  ('Scheduler', 'scheduler', 'Create and manage schedules', 40),
  ('HR Staff', 'hr_staff', 'Manage employee records and time off', 40),
  ('Caregiver', 'caregiver', 'View assigned shifts and update availability', 20),
  ('Client', 'client', 'View care schedule and manage preferences', 10)
ON CONFLICT (role_code) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_system_roles_updated_at
  BEFORE UPDATE ON public.system_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();