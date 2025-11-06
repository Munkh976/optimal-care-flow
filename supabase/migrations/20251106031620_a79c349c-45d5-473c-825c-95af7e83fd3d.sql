-- Allow clients to manage their own care needs
CREATE POLICY "Clients can manage their own care needs"
ON public.client_care_needs
FOR ALL
TO authenticated
USING (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE user_id = auth.uid()
  )
);