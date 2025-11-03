-- Drop existing policies on clients table
DROP POLICY IF EXISTS "Agency users can manage their clients" ON public.clients;
DROP POLICY IF EXISTS "Require authentication for client access" ON public.clients;

-- Create new role-based policies for clients table

-- SELECT: Admins, managers, schedulers, and HR staff can view clients
CREATE POLICY "Staff can view clients"
ON public.clients
FOR SELECT
TO authenticated
USING (
  (auth.uid() = agency_id) AND (
    has_role(auth.uid(), 'system_admin'::app_role) OR
    has_role(auth.uid(), 'agency_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'scheduler'::app_role) OR
    has_role(auth.uid(), 'hr_staff'::app_role)
  )
);

-- INSERT: Only admins and managers can add clients
CREATE POLICY "Admins and managers can add clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = agency_id) AND (
    has_role(auth.uid(), 'system_admin'::app_role) OR
    has_role(auth.uid(), 'agency_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);

-- UPDATE: Only admins and managers can update clients
CREATE POLICY "Admins and managers can update clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = agency_id) AND (
    has_role(auth.uid(), 'system_admin'::app_role) OR
    has_role(auth.uid(), 'agency_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);

-- DELETE: Only admins and managers can delete clients
CREATE POLICY "Admins and managers can delete clients"
ON public.clients
FOR DELETE
TO authenticated
USING (
  (auth.uid() = agency_id) AND (
    has_role(auth.uid(), 'system_admin'::app_role) OR
    has_role(auth.uid(), 'agency_admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  )
);