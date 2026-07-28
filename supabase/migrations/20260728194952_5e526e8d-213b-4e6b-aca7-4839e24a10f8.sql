-- Fix shift_trades policies (previous ones compared agency_id to auth.uid())
DROP POLICY IF EXISTS "Agency users can view shift trades" ON public.shift_trades;
DROP POLICY IF EXISTS "Agency users can update shift trades" ON public.shift_trades;
DROP POLICY IF EXISTS "Caregivers can create shift trades" ON public.shift_trades;

CREATE POLICY "Agency staff can view shift trades"
ON public.shift_trades FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.caregivers c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = shift_trades.original_caregiver_id AND c.agency_id = p.agency_id
  )
);

CREATE POLICY "Agency staff can manage shift trades"
ON public.shift_trades FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.caregivers c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = shift_trades.original_caregiver_id AND c.agency_id = p.agency_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.caregivers c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = shift_trades.original_caregiver_id AND c.agency_id = p.agency_id
  )
);

CREATE POLICY "Agency staff and caregivers can create shift trades"
ON public.shift_trades FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.caregivers c
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE c.id = shift_trades.original_caregiver_id AND c.agency_id = p.agency_id
  )
);

-- Staff can queue notifications
CREATE POLICY "Staff can create pending notifications"
ON public.pending_notifications FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'system_admin')
  OR public.has_role(auth.uid(), 'agency_admin')
  OR public.has_role(auth.uid(), 'manager')
);