
-- 1. Register missing modules
INSERT INTO public.system_modules (module_code, module_name, description, category, is_active) VALUES
  ('caregiver_approvals', 'Caregiver Applications', 'Review and approve self-registered caregivers', 'operations', true),
  ('notifications_outbox', 'Notification Outbox', 'Messages queued for manual delivery', 'operations', true),
  ('time_off', 'Time Off Requests', 'Review caregiver time off requests', 'operations', true),
  ('shift_trades', 'Shift Trades', 'Manage shift trade requests', 'operations', true),
  ('live_operations', 'Live Operations', 'Real-time operations board', 'operations', true),
  ('quick_assign', 'Quick Assign', 'Quickly assign caregivers to shifts', 'operations', true),
  ('auto_schedule', 'Auto Schedule', 'Automated schedule generation', 'operations', true),
  ('available_shifts', 'Available Shifts', 'Open shifts caregivers can claim', 'caregiver', true),
  ('caregiver_dashboard', 'My Dashboard', 'Caregiver home', 'caregiver', true),
  ('caregiver_time_off', 'My Time Off', 'Caregiver time off requests', 'caregiver', true),
  ('caregiver_settings', 'My Profile', 'Caregiver profile settings', 'caregiver', true),
  ('care_types', 'Care Types', 'Configure care types and skills', 'configuration', true),
  ('agency_settings', 'Agency Settings', 'Agency profile and configuration', 'configuration', true),
  ('user_roles', 'User Role Assignments', 'Assign roles to system users', 'platform', true),
  ('system_roles', 'System Roles', 'Define system roles and access levels', 'platform', true),
  ('role_permissions', 'Role Permissions', 'Configure module permissions per role', 'platform', true),
  ('admin_utilities', 'Admin Utilities', 'Maintenance and data utilities', 'platform', true)
ON CONFLICT (module_code) DO UPDATE
  SET module_name = EXCLUDED.module_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      is_active = true;

-- 2. Move platform administration modules into the platform group
UPDATE public.system_modules SET category = 'platform' WHERE module_code IN ('users');

-- 3. Grants
INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete) VALUES
  -- Caregiver applications
  ('agency_admin','caregiver_approvals', true, true, true, true),
  ('manager','caregiver_approvals', true, true, true, false),
  ('hr_staff','caregiver_approvals', true, true, true, false),
  ('system_admin','caregiver_approvals', true, true, true, true),
  -- Notification outbox
  ('agency_admin','notifications_outbox', false, true, true, false),
  ('manager','notifications_outbox', false, true, true, false),
  ('system_admin','notifications_outbox', false, true, true, true),
  -- Time off
  ('agency_admin','time_off', true, true, true, true),
  ('manager','time_off', true, true, true, false),
  ('scheduler','time_off', false, true, true, false),
  -- Shift trades
  ('agency_admin','shift_trades', true, true, true, true),
  ('manager','shift_trades', true, true, true, false),
  ('scheduler','shift_trades', true, true, true, false),
  ('caregiver','shift_trades', true, true, false, false),
  -- Live operations
  ('agency_admin','live_operations', false, true, true, false),
  ('manager','live_operations', false, true, true, false),
  ('scheduler','live_operations', false, true, true, false),
  -- Quick assign
  ('agency_admin','quick_assign', true, true, true, false),
  ('manager','quick_assign', true, true, true, false),
  ('scheduler','quick_assign', true, true, true, false),
  -- Auto schedule
  ('agency_admin','auto_schedule', true, true, true, false),
  ('manager','auto_schedule', true, true, true, false),
  ('scheduler','auto_schedule', true, true, true, false),
  -- Caregiver portal
  ('caregiver','available_shifts', true, true, false, false),
  ('caregiver','caregiver_dashboard', false, true, false, false),
  ('caregiver','caregiver_time_off', true, true, true, true),
  ('caregiver','caregiver_settings', false, true, true, false),
  -- Configuration
  ('agency_admin','care_types', true, true, true, true),
  ('manager','care_types', false, true, true, false),
  ('agency_admin','agency_settings', false, true, true, false),
  -- Platform (system admin only)
  ('system_admin','user_roles', true, true, true, true),
  ('system_admin','system_roles', true, true, true, true),
  ('system_admin','role_permissions', true, true, true, true),
  ('system_admin','admin_utilities', true, true, true, true)
ON CONFLICT (role_code, module_code) DO UPDATE
  SET can_create = EXCLUDED.can_create,
      can_read = EXCLUDED.can_read,
      can_update = EXCLUDED.can_update,
      can_delete = EXCLUDED.can_delete;
