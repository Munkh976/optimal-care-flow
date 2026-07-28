-- 1. Care service trade approval flag
ALTER TABLE public.care_types
  ADD COLUMN IF NOT EXISTS requires_trade_approval boolean NOT NULL DEFAULT false;

-- 2. Agency-level scheduling rules + smart match weights
ALTER TABLE public.agency
  ADD COLUMN IF NOT EXISTS max_weekly_hours integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS travel_buffer_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS late_trade_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS smart_match_weights jsonb NOT NULL DEFAULT
    '{"skill":30,"availability":25,"reliability":15,"continuity":10,"rating":10,"distance":5,"cost":5}'::jsonb;

-- 3. Shift trades: eligibility + decision trail
ALTER TABLE public.shift_trades
  ADD COLUMN IF NOT EXISTS shift_id uuid,
  ADD COLUMN IF NOT EXISTS eligibility_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS auto_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_manager_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_reasons text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decision_notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 4. Manager override trail on assignments
ALTER TABLE public.shift_assignments
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS override_by uuid,
  ADD COLUMN IF NOT EXISTS override_at timestamptz;

-- 5. Shift ratings
CREATE TABLE IF NOT EXISTS public.shift_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_ratings TO authenticated;
GRANT ALL ON public.shift_ratings TO service_role;

ALTER TABLE public.shift_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency staff can view ratings in their agency"
ON public.shift_ratings FOR SELECT TO authenticated
USING (agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Agency staff can manage ratings in their agency"
ON public.shift_ratings FOR ALL TO authenticated
USING (
  agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  AND (public.has_role(auth.uid(), 'agency_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'system_admin'))
)
WITH CHECK (
  agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  AND (public.has_role(auth.uid(), 'agency_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'system_admin'))
);

CREATE POLICY "Clients can rate their own shifts"
ON public.shift_ratings FOR INSERT TO authenticated
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER update_shift_ratings_updated_at
BEFORE UPDATE ON public.shift_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_shift_ratings_caregiver ON public.shift_ratings(caregiver_id);

-- 6. Caregiver performance view
CREATE OR REPLACE VIEW public.caregiver_performance
WITH (security_invoker = true) AS
SELECT
  c.id AS caregiver_id,
  c.agency_id,
  COUNT(*) FILTER (WHERE sa.status = 'completed') AS lifetime_completed,
  COUNT(*) FILTER (WHERE sa.status = 'no_show') AS lifetime_no_shows,
  COUNT(*) FILTER (WHERE s.shift_date >= CURRENT_DATE - 30) AS shifts_last_30d,
  COALESCE(SUM(sa.actual_hours_worked) FILTER (WHERE s.shift_date >= CURRENT_DATE - 30), 0) AS hours_last_30d,
  COALESCE(SUM(sa.actual_hours_worked), 0) AS lifetime_hours,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE sa.status = 'completed')
    / NULLIF(COUNT(*) FILTER (WHERE sa.status IN ('completed','no_show','cancelled')), 0)
  , 1) AS completion_rate,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE sa.clock_in_time IS NOT NULL
        AND sa.clock_in_time <= (s.shift_date + s.start_time) AT TIME ZONE 'UTC' + interval '5 minutes'
    )
    / NULLIF(COUNT(*) FILTER (WHERE sa.clock_in_time IS NOT NULL), 0)
  , 1) AS on_time_rate,
  (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.shift_ratings r WHERE r.caregiver_id = c.id) AS avg_rating,
  (SELECT COUNT(*) FROM public.shift_ratings r WHERE r.caregiver_id = c.id) AS rating_count
FROM public.caregivers c
LEFT JOIN public.shift_assignments sa ON sa.caregiver_id = c.id
LEFT JOIN public.shifts s ON s.id = sa.shift_id
GROUP BY c.id, c.agency_id;

GRANT SELECT ON public.caregiver_performance TO authenticated;
GRANT SELECT ON public.caregiver_performance TO service_role;