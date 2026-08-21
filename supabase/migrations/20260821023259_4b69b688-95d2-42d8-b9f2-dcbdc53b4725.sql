-- Step 2: no-op-safe backfill (0 rows expected)
INSERT INTO public.shift_assignments (shift_id, caregiver_id, status, assignment_method, assigned_at)
SELECT s.id, s.caregiver_id,
       CASE WHEN s.status = 'completed' THEN 'completed'::assignment_status ELSE 'scheduled'::assignment_status END,
       'manual'::assignment_method, COALESCE(s.updated_at, now())
FROM public.shifts s
WHERE s.caregiver_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.shift_assignments a WHERE a.shift_id = s.id);

-- Step 3: one-directional derivation. shift_assignments is the writer; shifts.caregiver_id follows.
CREATE OR REPLACE FUNCTION public.derived_shift_caregiver(_shift_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.caregiver_id
  FROM public.shift_assignments a
  WHERE a.shift_id = _shift_id
    AND a.status <> 'cancelled'::assignment_status
  ORDER BY (a.status = 'completed'::assignment_status) DESC, a.assigned_at DESC NULLS LAST, a.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.sync_shift_caregiver_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shift_id uuid := COALESCE(NEW.shift_id, OLD.shift_id);
  v_caregiver uuid;
BEGIN
  v_caregiver := public.derived_shift_caregiver(v_shift_id);

  UPDATE public.shifts s
  SET caregiver_id = v_caregiver,
      status = CASE
        WHEN v_caregiver IS NOT NULL AND s.status IN ('open','unassigned') THEN 'assigned'::shift_status
        WHEN v_caregiver IS NULL AND s.status = 'assigned'::shift_status THEN 'open'::shift_status
        ELSE s.status
      END
  WHERE s.id = v_shift_id
    AND (s.caregiver_id IS DISTINCT FROM v_caregiver
         OR (v_caregiver IS NOT NULL AND s.status IN ('open','unassigned'))
         OR (v_caregiver IS NULL AND s.status = 'assigned'::shift_status));

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_shift_caregiver ON public.shift_assignments;
CREATE TRIGGER trg_sync_shift_caregiver
AFTER INSERT OR UPDATE OR DELETE ON public.shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_shift_caregiver_from_assignment();

-- Guard: direct writes to shifts.caregiver_id are auto-corrected back to the derived value.
CREATE OR REPLACE FUNCTION public.enforce_derived_shift_caregiver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.caregiver_id := public.derived_shift_caregiver(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_derived_shift_caregiver ON public.shifts;
CREATE TRIGGER trg_enforce_derived_shift_caregiver
BEFORE INSERT OR UPDATE OF caregiver_id ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.enforce_derived_shift_caregiver();

-- Step 5: deprecation marker
COMMENT ON COLUMN public.shifts.caregiver_id IS
  'DEPRECATED / DERIVED: maintained automatically from public.shift_assignments by trg_sync_shift_caregiver. Do not write directly; direct writes are auto-corrected. Source of truth is shift_assignments.';