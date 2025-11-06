-- Allow clients to view caregivers in their agency (new policy)
CREATE POLICY "Clients view caregivers (agency scope) 20251106"
ON public.caregivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.clients cl
    WHERE cl.user_id = auth.uid()
      AND cl.agency_id = caregivers.agency_id
  )
);

-- Allow clients to view caregiver availability for caregivers in their agency (new policy)
CREATE POLICY "Clients view caregiver availability (agency scope) 20251106"
ON public.caregiver_availability
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.caregivers c
    JOIN public.clients cl ON cl.agency_id = c.agency_id
    WHERE c.id = caregiver_availability.caregiver_id
      AND cl.user_id = auth.uid()
  )
);
