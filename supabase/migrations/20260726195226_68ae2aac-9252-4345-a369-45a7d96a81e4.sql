-- 1. Remove overly permissive "authenticated = full access" policies
DROP POLICY IF EXISTS "Require authentication for caregiver access" ON public.caregivers;
DROP POLICY IF EXISTS "Require authentication for client order access" ON public.client_orders;
DROP POLICY IF EXISTS "Require authentication for shift access" ON public.shifts;
DROP POLICY IF EXISTS "Require authentication for shift assignment access" ON public.shift_assignments;

-- 2. Fix shift_assignments scoping (was comparing shifts.agency_id to auth.uid())
DROP POLICY IF EXISTS "Agency users can manage shift assignments" ON public.shift_assignments;
CREATE POLICY "Agency users can manage shift assignments"
ON public.shift_assignments FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shifts s
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE s.id = shift_assignments.shift_id AND s.agency_id = p.agency_id
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shifts s
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE s.id = shift_assignments.shift_id AND s.agency_id = p.agency_id
));

CREATE POLICY "Caregivers can view their own shift assignments"
ON public.shift_assignments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.caregivers c
  WHERE c.id = shift_assignments.caregiver_id AND c.user_id = auth.uid()
));

-- 3. Ensure agency-scoped policies target authenticated role and have WITH CHECK
DROP POLICY IF EXISTS "Agency users can manage their caregivers" ON public.caregivers;
CREATE POLICY "Agency users can manage their caregivers"
ON public.caregivers FOR ALL TO authenticated
USING (agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "Agency users can manage their shifts" ON public.shifts;
CREATE POLICY "Agency users can manage their shifts"
ON public.shifts FOR ALL TO authenticated
USING (agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Caregivers can view their assigned shifts"
ON public.shifts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.caregivers c
  WHERE c.id = shifts.caregiver_id AND c.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Agency users can manage their client orders" ON public.client_orders;
CREATE POLICY "Agency users can manage their client orders"
ON public.client_orders FOR ALL TO authenticated
USING (agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()))
WITH CHECK (agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()));

-- 4. Agency table: no more public read of tax/contact info
DROP POLICY IF EXISTS "Authenticated users can view agencies" ON public.agency;
CREATE POLICY "Members can view their own agency"
ON public.agency FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid())
);

-- 5. Fix agency_id / auth.uid() mismatches on time_off_requests
DROP POLICY IF EXISTS "Caregivers can view their own time off requests" ON public.time_off_requests;
CREATE POLICY "Caregivers can view their own time off requests"
ON public.time_off_requests FOR SELECT TO authenticated
USING (caregiver_id IN (SELECT c.id FROM public.caregivers c WHERE c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Caregivers can create time off requests" ON public.time_off_requests;
CREATE POLICY "Caregivers can create time off requests"
ON public.time_off_requests FOR INSERT TO authenticated
WITH CHECK (caregiver_id IN (SELECT c.id FROM public.caregivers c WHERE c.user_id = auth.uid()));

-- 6. Scope caregiver_registrations staff access to the staff member's agency
DROP POLICY IF EXISTS "Staff can view caregiver registrations" ON public.caregiver_registrations;
CREATE POLICY "Staff can view caregiver registrations"
ON public.caregiver_registrations FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'system_admin'::app_role)
   OR has_role(auth.uid(), 'agency_admin'::app_role)
   OR has_role(auth.uid(), 'manager'::app_role)
   OR has_role(auth.uid(), 'hr_staff'::app_role))
  AND (
    has_role(auth.uid(), 'system_admin'::app_role)
    OR agency_id IS NULL
    OR agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Staff can update caregiver registrations" ON public.caregiver_registrations;
CREATE POLICY "Staff can update caregiver registrations"
ON public.caregiver_registrations FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'system_admin'::app_role)
   OR has_role(auth.uid(), 'agency_admin'::app_role)
   OR has_role(auth.uid(), 'manager'::app_role)
   OR has_role(auth.uid(), 'hr_staff'::app_role))
  AND (
    has_role(auth.uid(), 'system_admin'::app_role)
    OR agency_id IS NULL
    OR agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid())
  )
);

-- 7. Drop the deprecated, escalation-prone role column on profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 8. Remove signed-out (anon) access to every data table; keep the public
--    caregiver self-registration form working (insert only).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT INSERT ON public.caregiver_registrations TO anon;

-- 9. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_caregiver_role(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_caregiver_with_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_client_with_profile(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_caregiver_role(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_caregiver_with_profile(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_client_with_profile(uuid) TO service_role;