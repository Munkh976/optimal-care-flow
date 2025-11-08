-- MODULE 1: Fix core routing and permissions
-- This ensures proper module categorization and role assignments

-- 1. Fix the 'agency' module - it should be 'System Settings' under administration
UPDATE system_modules 
SET 
  module_name = 'System Settings',
  category = 'administration'
WHERE module_code = 'agency';

-- 2. Add reports module route if missing
INSERT INTO system_modules (module_code, module_name, category, is_active)
VALUES ('reports', 'Reports & Analytics', 'reporting', true)
ON CONFLICT (module_code) DO NOTHING;

-- 3. Add missing permissions for manager role
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
VALUES 
  ('manager', 'caregiver_registration', false, true, false, false),
  ('manager', 'reports', false, true, false, false)
ON CONFLICT (role_code, module_code) DO UPDATE SET
  can_read = EXCLUDED.can_read;

-- 4. Ensure scheduler has access to key scheduling modules
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
VALUES 
  ('scheduler', 'shifts', true, true, true, false),
  ('scheduler', 'auto_schedule', true, true, true, false),
  ('scheduler', 'available_shifts', false, true, false, false),
  ('scheduler', 'quick_assign', true, true, true, false),
  ('scheduler', 'orders', false, true, false, false),
  ('scheduler', 'caregivers', false, true, false, false),
  ('scheduler', 'clients', false, true, false, false)
ON CONFLICT (role_code, module_code) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_create = EXCLUDED.can_create,
  can_update = EXCLUDED.can_update;