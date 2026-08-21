-- Helpers (security definer to avoid cross-table policy recursion)
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_agency_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('system_admin','agency_admin','manager','scheduler','hr_staff')
  )
$$;

CREATE OR REPLACE FUNCTION public.my_caregiver_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.caregivers WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_client_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.clients WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_my_assigned_shift(_shift_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shift_assignments sa
    JOIN public.caregivers c ON c.id = sa.caregiver_id
    WHERE sa.shift_id = _shift_id AND c.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.order_agency_id(_order_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM public.client_orders WHERE id = _order_id
$$;

CREATE OR REPLACE FUNCTION public.order_client_id(_order_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.client_orders WHERE id = _order_id
$$;

CREATE OR REPLACE FUNCTION public.shift_assignment_agency_id(_shift_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM public.shifts WHERE id = _shift_id
$$;

-- SHIFTS
DROP POLICY IF EXISTS "Agency users can manage their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Caregivers can view their assigned shifts" ON public.shifts;

CREATE POLICY "Agency staff manage shifts in their agency"
ON public.shifts FOR ALL TO authenticated
USING (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
WITH CHECK (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id());

CREATE POLICY "Caregivers read their own assigned shifts"
ON public.shifts FOR SELECT TO authenticated
USING (public.is_my_assigned_shift(id));

CREATE POLICY "Clients read their own shifts"
ON public.shifts FOR SELECT TO authenticated
USING (client_id IN (SELECT public.my_client_ids()));

-- SHIFT ASSIGNMENTS
DROP POLICY IF EXISTS "Agency users can manage shift assignments" ON public.shift_assignments;
DROP POLICY IF EXISTS "Caregivers can view their own shift assignments" ON public.shift_assignments;

CREATE POLICY "Agency staff manage assignments in their agency"
ON public.shift_assignments FOR ALL TO authenticated
USING (public.is_agency_staff(auth.uid())
       AND public.shift_assignment_agency_id(shift_id) = public.current_agency_id())
WITH CHECK (public.is_agency_staff(auth.uid())
       AND public.shift_assignment_agency_id(shift_id) = public.current_agency_id());

CREATE POLICY "Caregivers read their own assignments"
ON public.shift_assignments FOR SELECT TO authenticated
USING (caregiver_id IN (SELECT public.my_caregiver_ids()));

-- CLIENT ORDERS (Care Plans)
DROP POLICY IF EXISTS "Agency users can manage their client orders" ON public.client_orders;

CREATE POLICY "Agency staff manage care plans in their agency"
ON public.client_orders FOR ALL TO authenticated
USING (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
WITH CHECK (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id());

CREATE POLICY "Clients read their own care plans"
ON public.client_orders FOR SELECT TO authenticated
USING (client_id IN (SELECT public.my_client_ids()));

-- ORDER SERVICES (service lines)
DROP POLICY IF EXISTS "Agency users can manage order services" ON public.order_services;

CREATE POLICY "Agency staff manage service lines in their agency"
ON public.order_services FOR ALL TO authenticated
USING (public.is_agency_staff(auth.uid())
       AND public.order_agency_id(order_id) = public.current_agency_id())
WITH CHECK (public.is_agency_staff(auth.uid())
       AND public.order_agency_id(order_id) = public.current_agency_id());

CREATE POLICY "Clients read their own service lines"
ON public.order_services FOR SELECT TO authenticated
USING (public.order_client_id(order_id) IN (SELECT public.my_client_ids()));
