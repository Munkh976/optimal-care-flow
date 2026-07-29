INSERT INTO public.system_modules (module_code, module_name, description, category, is_active)
VALUES ('care_service_categories', 'Care Service Categories', 'Manage the category list used by Care Services', 'configuration', true)
ON CONFLICT (module_code) DO UPDATE
SET module_name = EXCLUDED.module_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = true,
    updated_at = now();

INSERT INTO public.role_permissions (role_code, module_code, can_create, can_read, can_update, can_delete)
VALUES
  ('agency_admin', 'care_service_categories', true, true, true, true),
  ('manager', 'care_service_categories', true, true, true, false)
ON CONFLICT (role_code, module_code) DO UPDATE
SET can_create = EXCLUDED.can_create,
    can_read = EXCLUDED.can_read,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete,
    updated_at = now();