-- Create system modules table to define all modules/features in the system
CREATE TABLE IF NOT EXISTS public.system_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_code text NOT NULL UNIQUE,
  module_name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create role permissions table to store CRUD permissions for each role on each module
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_code app_role NOT NULL,
  module_code text NOT NULL REFERENCES public.system_modules(module_code) ON DELETE CASCADE,
  can_create boolean DEFAULT false,
  can_read boolean DEFAULT false,
  can_update boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(role_code, module_code)
);

-- Enable RLS
ALTER TABLE public.system_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_modules
CREATE POLICY "Anyone authenticated can view active modules"
  ON public.system_modules FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

CREATE POLICY "System admins can manage modules"
  ON public.system_modules FOR ALL
  USING (has_role(auth.uid(), 'system_admin'::app_role));

-- RLS Policies for role_permissions
CREATE POLICY "Anyone authenticated can view permissions"
  ON public.role_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System admins can manage permissions"
  ON public.role_permissions FOR ALL
  USING (has_role(auth.uid(), 'system_admin'::app_role));

-- Insert default system modules
INSERT INTO public.system_modules (module_code, module_name, description, category) VALUES
  ('users', 'User Management', 'Manage system users and accounts', 'administration'),
  ('user_roles', 'User Roles', 'Assign and manage user roles', 'administration'),
  ('system_roles', 'System Roles', 'Define and manage system role definitions', 'administration'),
  ('caregivers', 'Caregivers', 'Manage caregiver profiles and information', 'operations'),
  ('clients', 'Clients', 'Manage client profiles and information', 'operations'),
  ('shifts', 'Shifts', 'Manage shift scheduling and assignments', 'operations'),
  ('orders', 'Client Orders', 'Manage client care orders', 'operations'),
  ('availability', 'Caregiver Availability', 'Manage caregiver availability schedules', 'operations'),
  ('time_off', 'Time Off Requests', 'Manage caregiver time off requests', 'operations'),
  ('shift_trades', 'Shift Trades', 'Manage shift trade requests', 'operations'),
  ('care_types', 'Care Types', 'Define and manage care type definitions', 'configuration'),
  ('care_needs', 'Care Needs', 'Define and manage care need definitions', 'configuration'),
  ('reports', 'Reports & Analytics', 'View reports and analytics', 'reporting'),
  ('agency', 'Agency Settings', 'Manage agency-wide settings', 'administration');

-- Insert default permissions for system_admin (full access to everything)
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'system_admin'::app_role, module_code, true, true, true, true
FROM public.system_modules;

-- Insert default permissions for agency_admin (full access except system_roles)
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'agency_admin'::app_role, module_code, true, true, true, 
  CASE WHEN module_code IN ('system_roles', 'user_roles') THEN false ELSE true END
FROM public.system_modules
WHERE module_code != 'system_roles';

-- Insert default permissions for manager
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'manager'::app_role, module_code, 
  CASE WHEN module_code IN ('caregivers', 'clients', 'shifts', 'orders', 'availability', 'time_off') THEN true ELSE false END,
  CASE WHEN module_code IN ('system_roles', 'user_roles', 'users') THEN false ELSE true END,
  CASE WHEN module_code IN ('caregivers', 'clients', 'shifts', 'orders', 'availability', 'time_off') THEN true ELSE false END,
  false
FROM public.system_modules;

-- Insert default permissions for scheduler
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'scheduler'::app_role, module_code,
  CASE WHEN module_code IN ('shifts', 'availability') THEN true ELSE false END,
  CASE WHEN module_code IN ('caregivers', 'clients', 'shifts', 'orders', 'availability', 'time_off', 'shift_trades') THEN true ELSE false END,
  CASE WHEN module_code IN ('shifts', 'availability', 'shift_trades') THEN true ELSE false END,
  false
FROM public.system_modules;

-- Insert default permissions for hr_staff
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'hr_staff'::app_role, module_code,
  CASE WHEN module_code IN ('caregivers', 'time_off') THEN true ELSE false END,
  CASE WHEN module_code IN ('caregivers', 'time_off', 'users') THEN true ELSE false END,
  CASE WHEN module_code IN ('caregivers', 'time_off') THEN true ELSE false END,
  false
FROM public.system_modules;

-- Insert default permissions for caregiver (read-only for most, manage own data)
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'caregiver'::app_role, module_code,
  CASE WHEN module_code IN ('availability', 'time_off', 'shift_trades') THEN true ELSE false END,
  CASE WHEN module_code IN ('shifts', 'availability', 'time_off', 'shift_trades', 'clients') THEN true ELSE false END,
  CASE WHEN module_code IN ('availability', 'shift_trades') THEN true ELSE false END,
  false
FROM public.system_modules;

-- Insert default permissions for client (view only for their own data)
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'client'::app_role, module_code,
  false,
  CASE WHEN module_code IN ('caregivers', 'shifts', 'orders') THEN true ELSE false END,
  false,
  false
FROM public.system_modules;

-- Create helper function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _module_code text,
  _permission_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_code = ur.role
    WHERE ur.user_id = _user_id
      AND rp.module_code = _module_code
      AND (
        CASE _permission_type
          WHEN 'create' THEN rp.can_create
          WHEN 'read' THEN rp.can_read
          WHEN 'update' THEN rp.can_update
          WHEN 'delete' THEN rp.can_delete
          ELSE false
        END
      )
  )
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_system_modules_updated_at
  BEFORE UPDATE ON public.system_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();