DROP POLICY IF EXISTS "Anyone can submit a pending caregiver registration" ON public.caregiver_registrations;
DROP POLICY IF EXISTS "Staff can update caregiver registrations" ON public.caregiver_registrations;

CREATE POLICY "Anyone can submit a pending caregiver registration"
ON public.caregiver_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  COALESCE(status, 'pending'::text) = 'pending'::text
  AND agency_id IS NULL
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND rejection_reason IS NULL
);
