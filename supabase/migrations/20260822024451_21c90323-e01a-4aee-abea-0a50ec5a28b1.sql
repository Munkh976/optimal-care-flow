INSERT INTO public.system_modules (module_code, module_name, description, category, is_active)
VALUES ('virtual_offices', 'Virtual Offices', 'Manage agency virtual offices: branding, service area, operating hours and scheduling overrides', 'configuration', true)
ON CONFLICT (module_code) DO NOTHING;

INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
VALUES
  ('agency_admin', 'virtual_offices', true, true, true, false),
  ('manager', 'virtual_offices', false, true, false, false)
ON CONFLICT DO NOTHING;