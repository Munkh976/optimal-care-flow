-- Add caregiver and client specific modules
INSERT INTO system_modules (module_code, module_name, category, is_active) VALUES
('caregiver_dashboard', 'My Dashboard', 'dashboard', true),
('caregiver_time_off', 'My Time Off', 'personal', true),
('caregiver_settings', 'My Settings', 'personal', true),
('client_dashboard', 'My Dashboard', 'dashboard', true)
ON CONFLICT (module_code) DO NOTHING;

-- Set up permissions for caregiver role
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'caregiver', module_code, 
  CASE 
    WHEN module_code IN ('caregiver_time_off') THEN true
    ELSE false
  END,
  true,
  CASE 
    WHEN module_code IN ('caregiver_settings', 'caregiver_time_off') THEN true
    ELSE false
  END,
  false
FROM system_modules
WHERE module_code IN ('caregiver_dashboard', 'available_shifts', 'caregiver_time_off', 'caregiver_settings')
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_create = EXCLUDED.can_create, can_read = EXCLUDED.can_read, 
    can_update = EXCLUDED.can_update, can_delete = EXCLUDED.can_delete;

-- Set up permissions for client role
INSERT INTO role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
SELECT 'client', module_code, false, true, false, false
FROM system_modules
WHERE module_code IN ('client_dashboard')
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_read = true;