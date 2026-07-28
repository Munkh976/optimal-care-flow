DROP POLICY IF EXISTS "Admins can manage care service categories" ON public.care_service_categories;
CREATE POLICY "Admins and managers can manage care service categories"
ON public.care_service_categories
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR public.has_role(auth.uid(), 'agency_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR public.has_role(auth.uid(), 'agency_admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

UPDATE public.role_permissions
SET can_create = true, can_delete = true, updated_at = now()
WHERE module_code = 'care_types' AND role_code = 'manager';