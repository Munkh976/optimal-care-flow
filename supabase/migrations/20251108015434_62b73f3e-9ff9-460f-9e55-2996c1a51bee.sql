-- Update agency module to be "System Settings"
UPDATE system_modules
SET module_name = 'System Settings'
WHERE module_code = 'agency';

-- Add missing modules for all pages
INSERT INTO system_modules (module_code, module_name, category, is_active) VALUES
('auto_schedule', 'Auto Schedule', 'scheduling', true),
('available_shifts', 'Available Shifts', 'scheduling', true),
('caregiver_approvals', 'Caregiver Approvals', 'operations', true),
('caregiver_registration', 'Caregiver Registration', 'operations', true),
('live_operations', 'Live Operations', 'operations', true),
('quick_assign', 'Quick Assign', 'scheduling', true)
ON CONFLICT (module_code) DO NOTHING;

-- Set up permissions for new modules
-- System Admin gets full access to everything
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'system_admin', module_code, true, true, true, true
FROM system_modules
WHERE module_code IN ('auto_schedule', 'available_shifts', 'caregiver_approvals', 'caregiver_registration', 'live_operations', 'quick_assign')
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_create = true, can_read = true, can_update = true, can_delete = true;

-- Agency Admin gets full access to operations
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'agency_admin', module_code, true, true, true, true
FROM system_modules
WHERE module_code IN ('auto_schedule', 'available_shifts', 'caregiver_approvals', 'caregiver_registration', 'live_operations', 'quick_assign')
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_create = true, can_read = true, can_update = true, can_delete = true;

-- Scheduler gets access to scheduling modules
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete) VALUES
('scheduler', 'auto_schedule', true, true, true, false),
('scheduler', 'available_shifts', true, true, true, false),
('scheduler', 'quick_assign', true, true, true, false),
('scheduler', 'caregiver_approvals', false, true, false, false),
('scheduler', 'live_operations', false, true, false, false)
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_create = EXCLUDED.can_create, can_read = EXCLUDED.can_read, 
    can_update = EXCLUDED.can_update, can_delete = EXCLUDED.can_delete;

-- Manager gets read access to operations
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete) VALUES
('manager', 'auto_schedule', false, true, false, false),
('manager', 'available_shifts', false, true, false, false),
('manager', 'caregiver_approvals', true, true, true, false),
('manager', 'live_operations', false, true, false, false),
('manager', 'quick_assign', false, true, false, false)
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_create = EXCLUDED.can_create, can_read = EXCLUDED.can_read, 
    can_update = EXCLUDED.can_update, can_delete = EXCLUDED.can_delete;