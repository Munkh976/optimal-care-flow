-- B. caregiver_certifications
DROP POLICY IF EXISTS "Agency users can manage certifications" ON public.caregiver_certifications;

CREATE OR REPLACE FUNCTION public.caregiver_agency_id(_caregiver_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM public.caregivers WHERE id = _caregiver_id
$$;

CREATE POLICY "Agency staff manage certifications in their agency"
ON public.caregiver_certifications FOR ALL TO authenticated
USING (public.is_agency_staff(auth.uid())
       AND public.caregiver_agency_id(caregiver_id) = public.current_agency_id())
WITH CHECK (public.is_agency_staff(auth.uid())
       AND public.caregiver_agency_id(caregiver_id) = public.current_agency_id());

CREATE POLICY "Caregivers read their own certifications"
ON public.caregiver_certifications FOR SELECT TO authenticated
USING (caregiver_id IN (SELECT public.my_caregiver_ids()));

COMMENT ON TABLE public.caregiver_certifications IS
  'DEPRECATED (2026-08): superseded by the certifications catalog; retained read-only pending removal. Do not build new dependencies.';

-- C. time_off_requests tenant isolation
ALTER TABLE public.time_off_requests ADD COLUMN IF NOT EXISTS agency_id uuid;

UPDATE public.time_off_requests t
SET agency_id = c.agency_id
FROM public.caregivers c
WHERE c.id = t.caregiver_id AND t.agency_id IS NULL;

DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM public.time_off_requests WHERE agency_id IS NULL;
  IF bad > 0 THEN
    RAISE EXCEPTION 'time_off_requests backfill incomplete: % rows unresolved', bad;
  END IF;
END $$;

ALTER TABLE public.time_off_requests ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE public.time_off_requests
  ADD CONSTRAINT time_off_requests_agency_id_fkey
  FOREIGN KEY (agency_id) REFERENCES public.agency(id);

CREATE OR REPLACE FUNCTION public.set_time_off_agency_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.agency_id IS NULL THEN
    SELECT agency_id INTO NEW.agency_id FROM public.caregivers WHERE id = NEW.caregiver_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_time_off_agency_id ON public.time_off_requests;
CREATE TRIGGER trg_time_off_agency_id
BEFORE INSERT ON public.time_off_requests
FOR EACH ROW EXECUTE FUNCTION public.set_time_off_agency_id();

DROP POLICY IF EXISTS "Managers can update time off requests" ON public.time_off_requests;
DROP POLICY IF EXISTS "Managers can view time off requests" ON public.time_off_requests;

CREATE POLICY "Agency staff view time off in their agency"
ON public.time_off_requests FOR SELECT TO authenticated
USING (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id());

CREATE POLICY "Agency managers decide time off in their agency"
ON public.time_off_requests FOR UPDATE TO authenticated
USING ((has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'agency_admin'::app_role) OR has_role(auth.uid(),'system_admin'::app_role))
       AND agency_id = public.current_agency_id())
WITH CHECK ((has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'agency_admin'::app_role) OR has_role(auth.uid(),'system_admin'::app_role))
       AND agency_id = public.current_agency_id());

-- Lock helper execution to signed-in users only
REVOKE EXECUTE ON FUNCTION public.current_agency_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_agency_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_caregiver_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_client_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_my_assigned_shift(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.order_agency_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.order_client_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.shift_assignment_agency_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.caregiver_agency_id(uuid) FROM anon;
