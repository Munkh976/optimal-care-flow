CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_active_per_assignment
  ON public.time_entries (shift_assignment_id)
  WHERE voided_at IS NULL;

COMMENT ON INDEX public.time_entries_one_active_per_assignment IS
  'Home-care model: exactly one active (non-voided) time entry per shift assignment. Corrections amend this row (source=correction); they never add a second segment.';

CREATE OR REPLACE FUNCTION public.sync_assignment_time_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE aid uuid;
BEGIN
  aid := COALESCE(NEW.shift_assignment_id, OLD.shift_assignment_id);
  -- 1:1 model: at most one active entry per assignment (enforced by
  -- time_entries_one_active_per_assignment). No segment aggregation.
  UPDATE public.shift_assignments sa
  SET clock_in_time = t.started_at,
      clock_out_time = t.ended_at,
      actual_hours_worked = t.hours_worked,
      mileage = NULLIF(COALESCE(t.mileage, 0), 0)
  FROM (
    SELECT te.started_at, te.ended_at, te.hours_worked, te.mileage
    FROM public.time_entries te
    WHERE te.shift_assignment_id = aid
      AND te.voided_at IS NULL
      AND te.status IN ('submitted','approved')
    LIMIT 1
  ) t
  WHERE sa.id = aid;
  RETURN NULL;
END;
$function$;