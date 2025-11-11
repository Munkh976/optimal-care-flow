
-- Update munkh user to be associated with CareMuch agency
UPDATE public.profiles
SET agency_id = '56fbfe38-e8eb-40c1-ba27-07428f62ed2e'
WHERE email = 'munkh.mn@gmail.com';

UPDATE public.user_roles
SET agency_id = '56fbfe38-e8eb-40c1-ba27-07428f62ed2e'
WHERE user_id IN (SELECT id FROM profiles WHERE email = 'munkh.mn@gmail.com');

-- Fix RLS policies to check agency membership via profiles table
-- Drop old policies
DROP POLICY IF EXISTS "Agency users can manage their caregivers" ON public.caregivers;
DROP POLICY IF EXISTS "Agency users can manage their shifts" ON public.shifts;
DROP POLICY IF EXISTS "Admins and managers can add clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and managers can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and managers can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Staff can view clients" ON public.clients;
DROP POLICY IF EXISTS "Agency users can manage their client orders" ON public.client_orders;
DROP POLICY IF EXISTS "Agency users can manage client care needs" ON public.client_care_needs;

-- Create new policies that check profile.agency_id match
CREATE POLICY "Agency users can manage their caregivers"
ON public.caregivers
FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Agency users can manage their shifts"
ON public.shifts
FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Staff can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'system_admin'::app_role) OR
    has_role(auth.uid(), 'agency_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'scheduler'::app_role) OR
    has_role(auth.uid(), 'hr_staff'::app_role)
  )
);

CREATE POLICY "Admins and managers can manage clients"
ON public.clients
FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'system_admin'::app_role) OR
    has_role(auth.uid(), 'agency_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
)
WITH CHECK (
  agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  )
  AND (
    has_role(auth.uid(), 'system_admin'::app_role) OR
    has_role(auth.uid(), 'agency_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Agency users can manage their client orders"
ON public.client_orders
FOR ALL
TO authenticated
USING (
  agency_id IN (
    SELECT agency_id FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Agency users can manage client care needs"
ON public.client_care_needs
FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    )
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.profiles WHERE id = auth.uid()
    )
  )
);
