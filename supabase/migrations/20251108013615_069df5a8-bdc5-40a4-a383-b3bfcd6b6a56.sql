-- Extend agency table with business information
ALTER TABLE public.agency 
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS naics_code TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add agency_settings module to system_modules
INSERT INTO public.system_modules (module_code, module_name, description, category, is_active)
VALUES ('agency_settings', 'Agency Settings', 'Manage agency business information and configuration', 'configuration', true)
ON CONFLICT (module_code) DO NOTHING;

-- Add permissions for agency_settings module
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
VALUES 
  ('system_admin', 'agency_settings', true, true, true, true),
  ('agency_admin', 'agency_settings', false, true, true, false),
  ('manager', 'agency_settings', false, true, false, false),
  ('scheduler', 'agency_settings', false, true, false, false),
  ('hr_staff', 'agency_settings', false, true, false, false),
  ('caregiver', 'agency_settings', false, false, false, false),
  ('client', 'agency_settings', false, false, false, false)
ON CONFLICT (role_code, module_code) DO NOTHING;