ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS scheduling_flexibility text,
  ADD COLUMN IF NOT EXISTS scheduling_notes text;

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_scheduling_flexibility_chk;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_scheduling_flexibility_chk
  CHECK (scheduling_flexibility IS NULL OR scheduling_flexibility IN ('continuity','balanced','flexible'));

CREATE TABLE IF NOT EXISTS public.client_time_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  preferred_start time,
  preferred_end time,
  earliest_start time,
  latest_end time,
  min_duration_hours numeric,
  preferred_duration_hours numeric,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_time_windows_client ON public.client_time_windows(client_id);
CREATE INDEX IF NOT EXISTS idx_client_time_windows_agency ON public.client_time_windows(agency_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_time_windows TO authenticated;
GRANT ALL ON public.client_time_windows TO service_role;

ALTER TABLE public.client_time_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY ctw_select ON public.client_time_windows FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
  OR client_id IN (SELECT my_client_ids())
);

CREATE POLICY ctw_insert ON public.client_time_windows FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);

CREATE POLICY ctw_update ON public.client_time_windows FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
)
WITH CHECK (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);

CREATE POLICY ctw_delete ON public.client_time_windows FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'system_admin'::app_role)
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);

DROP TRIGGER IF EXISTS update_client_time_windows_updated_at ON public.client_time_windows;
CREATE TRIGGER update_client_time_windows_updated_at
BEFORE UPDATE ON public.client_time_windows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- One-time backfill from the most recent converted care request per client (history untouched)
WITH latest AS (
  SELECT DISTINCT ON (cr.client_id) cr.id, cr.client_id, cr.flexibility
  FROM public.care_requests cr
  WHERE cr.client_id IS NOT NULL
  ORDER BY cr.client_id, cr.created_at DESC
)
UPDATE public.clients c
SET scheduling_flexibility = latest.flexibility
FROM latest
WHERE c.id = latest.client_id
  AND c.scheduling_flexibility IS NULL
  AND latest.flexibility IS NOT NULL;

WITH latest AS (
  SELECT DISTINCT ON (cr.client_id) cr.id, cr.client_id
  FROM public.care_requests cr
  WHERE cr.client_id IS NOT NULL
  ORDER BY cr.client_id, cr.created_at DESC
)
INSERT INTO public.client_time_windows (
  client_id, agency_id, day_of_week, preferred_start, preferred_end,
  earliest_start, latest_end, min_duration_hours, preferred_duration_hours, notes, is_demo
)
SELECT l.client_id, c.agency_id, w.day_of_week, w.preferred_start, w.preferred_end,
       w.earliest_start, w.latest_end, w.min_duration_hours, w.preferred_duration_hours, w.notes, c.is_demo
FROM latest l
JOIN public.clients c ON c.id = l.client_id
JOIN public.care_request_time_windows w ON w.care_request_id = l.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_time_windows x WHERE x.client_id = l.client_id
);