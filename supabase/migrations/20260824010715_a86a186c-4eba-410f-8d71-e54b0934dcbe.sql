DROP VIEW IF EXISTS public.caregiver_performance;
CREATE VIEW public.caregiver_performance
WITH (security_invoker = true) AS
SELECT c.id AS caregiver_id,
  c.agency_id,
  count(*) FILTER (WHERE sa.status = 'completed'::assignment_status) AS lifetime_completed,
  count(*) FILTER (WHERE sa.status = 'no_show'::assignment_status) AS lifetime_no_shows,
  count(*) FILTER (WHERE sa.status = 'cancelled'::assignment_status) AS lifetime_cancelled,
  count(*) FILTER (WHERE s.shift_date >= (CURRENT_DATE - 30)) AS shifts_last_30d,
  COALESCE(sum(sa.actual_hours_worked) FILTER (WHERE s.shift_date >= (CURRENT_DATE - 30)), 0::numeric) AS hours_last_30d,
  COALESCE(sum(sa.actual_hours_worked), 0::numeric) AS lifetime_hours,
  round(100.0 * count(*) FILTER (WHERE sa.status = 'completed'::assignment_status)::numeric
    / NULLIF(count(*) FILTER (WHERE sa.status = ANY (ARRAY['completed'::assignment_status,'no_show'::assignment_status,'cancelled'::assignment_status])), 0)::numeric, 1) AS completion_rate,
  round(100.0 * count(*) FILTER (WHERE sa.clock_in_time IS NOT NULL AND sa.clock_in_time <= (((s.shift_date + s.start_time) AT TIME ZONE 'UTC') + '00:05:00'::interval))::numeric
    / NULLIF(count(*) FILTER (WHERE sa.clock_in_time IS NOT NULL), 0)::numeric, 1) AS on_time_rate,
  (SELECT round(avg(r.rating), 2) FROM public.shift_ratings r WHERE r.caregiver_id = c.id) AS avg_rating,
  (SELECT count(*) FROM public.shift_ratings r WHERE r.caregiver_id = c.id) AS rating_count,
  (SELECT round(avg(r.rating), 2) FROM public.shift_ratings r JOIN public.shifts rs ON rs.id = r.shift_id
     WHERE r.caregiver_id = c.id AND rs.shift_date >= (CURRENT_DATE - 90)) AS avg_rating_90d,
  (SELECT count(*) FROM public.shift_ratings r JOIN public.shifts rs ON rs.id = r.shift_id
     WHERE r.caregiver_id = c.id AND rs.shift_date >= (CURRENT_DATE - 90)) AS rating_count_90d
FROM public.caregivers c
LEFT JOIN public.shift_assignments sa ON sa.caregiver_id = c.id
LEFT JOIN public.shifts s ON s.id = sa.shift_id
GROUP BY c.id, c.agency_id;

GRANT SELECT ON public.caregiver_performance TO authenticated;
GRANT SELECT ON public.caregiver_performance TO service_role;

COMMENT ON COLUMN public.caregivers.performance_rating IS
  'DEPRECATED / frozen. Ratings are computed from public.shift_ratings via public.caregiver_performance (avg_rating, rating_count). This column is no longer authoritative and cannot be changed by app roles.';

CREATE OR REPLACE FUNCTION public.freeze_caregiver_performance_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.performance_rating IS DISTINCT FROM OLD.performance_rating THEN
    RAISE EXCEPTION 'caregivers.performance_rating is deprecated and derived: ratings come from shift_ratings (see caregiver_performance).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_caregiver_performance_rating ON public.caregivers;
CREATE TRIGGER freeze_caregiver_performance_rating
BEFORE UPDATE ON public.caregivers
FOR EACH ROW EXECUTE FUNCTION public.freeze_caregiver_performance_rating();