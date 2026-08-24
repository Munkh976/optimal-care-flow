-- ============ 1. Extend caregiver_availability ============
ALTER TABLE public.caregiver_availability
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agency(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS preferred_start time,
  ADD COLUMN IF NOT EXISTS preferred_end time,
  ADD COLUMN IF NOT EXISTS earliest_start time,
  ADD COLUMN IF NOT EXISTS latest_end time,
  ADD COLUMN IF NOT EXISTS flexibility_minutes integer NOT NULL DEFAULT 0;

UPDATE public.caregiver_availability av
   SET agency_id = c.agency_id
  FROM public.caregivers c
 WHERE c.id = av.caregiver_id AND av.agency_id IS NULL;

UPDATE public.caregiver_availability
   SET preferred_start = COALESCE(preferred_start, start_time),
       preferred_end   = COALESCE(preferred_end, end_time),
       earliest_start  = COALESCE(earliest_start, start_time),
       latest_end      = COALESCE(latest_end, end_time);

ALTER TABLE public.caregiver_availability
  ALTER COLUMN agency_id SET NOT NULL;

ALTER TABLE public.caregiver_availability
  DROP CONSTRAINT IF EXISTS caregiver_availability_window_chk;
ALTER TABLE public.caregiver_availability
  ADD CONSTRAINT caregiver_availability_window_chk CHECK (
    (preferred_start IS NULL OR preferred_end IS NULL OR preferred_end > preferred_start)
    AND (earliest_start IS NULL OR latest_end IS NULL OR latest_end > earliest_start)
    AND flexibility_minutes >= 0 AND flexibility_minutes <= 480
  );

-- keep the effective window (start_time/end_time, read by 2.5 eligibility) in sync
CREATE OR REPLACE FUNCTION public.sync_availability_effective_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agency_id IS NULL THEN
    SELECT c.agency_id INTO NEW.agency_id FROM public.caregivers c WHERE c.id = NEW.caregiver_id;
  END IF;
  NEW.preferred_start := COALESCE(NEW.preferred_start, NEW.start_time);
  NEW.preferred_end   := COALESCE(NEW.preferred_end, NEW.end_time);
  NEW.earliest_start  := COALESCE(NEW.earliest_start, NEW.preferred_start, NEW.start_time);
  NEW.latest_end      := COALESCE(NEW.latest_end, NEW.preferred_end, NEW.end_time);
  NEW.start_time      := COALESCE(NEW.earliest_start, NEW.start_time);
  NEW.end_time        := COALESCE(NEW.latest_end, NEW.end_time);
  NEW.updated_at      := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_availability_window ON public.caregiver_availability;
CREATE TRIGGER trg_sync_availability_window
BEFORE INSERT OR UPDATE ON public.caregiver_availability
FOR EACH ROW EXECUTE FUNCTION public.sync_availability_effective_window();

COMMENT ON COLUMN public.caregivers.availability IS
  'DEPRECATED (Phase B): unstructured legacy JSON. Not read by scheduling. Use caregiver_availability.';
COMMENT ON COLUMN public.caregiver_registrations.availability IS
  'DEPRECATED (Phase B): unstructured legacy JSON. Structured availability is captured post-approval in caregiver_availability.';

-- ============ 2. caregiver_availability_exceptions ============
CREATE TABLE IF NOT EXISTS public.caregiver_availability_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  is_available boolean NOT NULL DEFAULT false,
  start_time time,
  end_time time,
  reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT caregiver_availability_exceptions_unique UNIQUE (caregiver_id, exception_date),
  CONSTRAINT caregiver_availability_exceptions_window_chk CHECK (
    (is_available = false AND start_time IS NULL AND end_time IS NULL)
    OR (is_available = true AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_availability_exceptions TO authenticated;
GRANT ALL ON public.caregiver_availability_exceptions TO service_role;
ALTER TABLE public.caregiver_availability_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cae_select" ON public.caregiver_availability_exceptions
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'system_admin')
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);
CREATE POLICY "cae_insert" ON public.caregiver_availability_exceptions
FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(),'system_admin')
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);
CREATE POLICY "cae_update" ON public.caregiver_availability_exceptions
FOR UPDATE TO authenticated USING (
  has_role(auth.uid(),'system_admin')
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
) WITH CHECK (
  has_role(auth.uid(),'system_admin')
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);
CREATE POLICY "cae_delete" ON public.caregiver_availability_exceptions
FOR DELETE TO authenticated USING (
  has_role(auth.uid(),'system_admin')
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);

CREATE TRIGGER trg_cae_updated_at BEFORE UPDATE ON public.caregiver_availability_exceptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_exception_agency_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.agency_id IS NULL THEN
    SELECT c.agency_id INTO NEW.agency_id FROM public.caregivers c WHERE c.id = NEW.caregiver_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cae_agency BEFORE INSERT ON public.caregiver_availability_exceptions
FOR EACH ROW EXECUTE FUNCTION public.set_exception_agency_id();

-- ============ 3. care request flexibility + time windows ============
ALTER TABLE public.care_requests
  ADD COLUMN IF NOT EXISTS flexibility text;
ALTER TABLE public.care_requests DROP CONSTRAINT IF EXISTS care_requests_flexibility_chk;
ALTER TABLE public.care_requests
  ADD CONSTRAINT care_requests_flexibility_chk
  CHECK (flexibility IS NULL OR flexibility IN ('continuity','balanced','flexible'));

ALTER TABLE public.caregiver_preferences DROP CONSTRAINT IF EXISTS caregiver_preferences_flexibility_chk;
UPDATE public.caregiver_preferences SET flexibility =
  CASE flexibility WHEN 'strict' THEN 'continuity' WHEN 'moderate' THEN 'balanced' ELSE 'flexible' END;
ALTER TABLE public.caregiver_preferences
  ALTER COLUMN flexibility SET DEFAULT 'balanced';
ALTER TABLE public.caregiver_preferences
  ADD CONSTRAINT caregiver_preferences_flexibility_chk
  CHECK (flexibility IN ('continuity','balanced','flexible'));

CREATE TABLE IF NOT EXISTS public.care_request_time_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_request_id uuid NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  virtual_office_id uuid REFERENCES public.virtual_office(id) ON DELETE SET NULL,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  preferred_start time,
  preferred_end time,
  earliest_start time,
  latest_end time,
  min_duration_hours numeric,
  preferred_duration_hours numeric,
  flexibility text CHECK (flexibility IS NULL OR flexibility IN ('continuity','balanced','flexible')),
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crtw_window_chk CHECK (
    (preferred_start IS NULL OR preferred_end IS NULL OR preferred_end > preferred_start)
    AND (earliest_start IS NULL OR latest_end IS NULL OR latest_end > earliest_start)
  )
);
CREATE INDEX IF NOT EXISTS crtw_request_idx ON public.care_request_time_windows(care_request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_request_time_windows TO authenticated;
GRANT ALL ON public.care_request_time_windows TO service_role;
ALTER TABLE public.care_request_time_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crtw_select" ON public.care_request_time_windows
FOR SELECT TO authenticated USING (
  has_role(auth.uid(),'system_admin')
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);
CREATE POLICY "crtw_insert" ON public.care_request_time_windows
FOR INSERT TO authenticated WITH CHECK (
  has_role(auth.uid(),'system_admin')
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);
CREATE POLICY "crtw_update" ON public.care_request_time_windows
FOR UPDATE TO authenticated USING (
  has_role(auth.uid(),'system_admin')
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
) WITH CHECK (
  has_role(auth.uid(),'system_admin')
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);
CREATE POLICY "crtw_delete" ON public.care_request_time_windows
FOR DELETE TO authenticated USING (
  has_role(auth.uid(),'system_admin')
  OR (is_agency_staff(auth.uid()) AND agency_id = current_agency_id())
);

CREATE TRIGGER trg_crtw_updated_at BEFORE UPDATE ON public.care_request_time_windows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 4. Eligibility: honour date exceptions ============
CREATE OR REPLACE FUNCTION public.check_assignment_eligibility(_shift_id uuid, _caregiver_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record; cg record; cl record; svc record; r record;
  hard jsonb := '[]'::jsonb; soft jsonb := '[]'::jsonb; adv jsonb := '[]'::jsonb;
  v_cap numeric := 40; v_buffer int := 30; v_late int := 24;
  v_week_start date; v_week_end date;
  v_weekly numeric := 0; v_projected numeric; v_hours numeric;
  v_missing text[]; v_expired text[]; v_unverified text[];
  v_avail_rows int; v_covered boolean; v_dow int;
  v_hours_until numeric; v_exc record;
BEGIN
  SELECT * INTO s FROM public.shifts WHERE id = _shift_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'hard',
      jsonb_build_array(jsonb_build_object('code','shift_missing','label','Shift not found','detail','This shift no longer exists.')),
      'soft','[]'::jsonb,'advisory','[]'::jsonb,'weekly_hours',0,'projected_weekly_hours',0);
  END IF;

  SELECT * INTO cg FROM public.caregivers WHERE id = _caregiver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'hard',
      jsonb_build_array(jsonb_build_object('code','caregiver_missing','label','Caregiver not found','detail','This caregiver no longer exists.')),
      'soft','[]'::jsonb,'advisory','[]'::jsonb,'weekly_hours',0,'projected_weekly_hours',0);
  END IF;

  SELECT COALESCE(max_weekly_hours,40), COALESCE(travel_buffer_minutes,30), COALESCE(late_trade_hours,24)
    INTO v_cap, v_buffer, v_late
  FROM public.agency WHERE id = s.agency_id;
  v_cap := COALESCE(v_cap,40); v_buffer := COALESCE(v_buffer,30); v_late := COALESCE(v_late,24);

  v_hours := COALESCE(s.duration_hours, EXTRACT(EPOCH FROM (s.end_time - s.start_time))/3600.0);

  IF cg.agency_id IS DISTINCT FROM s.agency_id THEN
    hard := hard || jsonb_build_object('code','tenancy','label','Different agency','detail','Caregiver belongs to another agency.');
  END IF;

  IF cg.is_active IS FALSE THEN
    hard := hard || jsonb_build_object('code','inactive','label','Inactive caregiver','detail','This caregiver is not active.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shift_assignments a
    WHERE a.shift_id = _shift_id AND a.status IN ('in_progress','completed')
      AND a.caregiver_id <> _caregiver_id
  ) THEN
    hard := hard || jsonb_build_object('code','shift_taken','label','Shift already worked','detail','Another caregiver has already started or completed this shift.');
  END IF;

  IF s.status IN ('completed','cancelled') THEN
    hard := hard || jsonb_build_object('code','shift_state','label','Shift not open','detail','Shift is '||s.status||'.');
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT code FROM unnest(
      ARRAY[s.care_type_code]::text[] || COALESCE(s.required_skills, ARRAY[]::text[])
    ) AS code
    WHERE code IS NOT NULL AND code <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.caregiver_skills k
        WHERE k.caregiver_id = _caregiver_id AND k.care_type_code = code
      )
  ) INTO v_missing;
  IF array_length(v_missing,1) > 0 THEN
    hard := hard || jsonb_build_object('code','skill','label','Missing care service skill',
      'detail','Not qualified for '||array_to_string(v_missing,', ')||'.');
  END IF;

  SELECT ARRAY(SELECT certification_name FROM public.caregiver_certifications
               WHERE caregiver_id=_caregiver_id AND expiry_date IS NOT NULL AND expiry_date < s.shift_date)
    INTO v_expired;
  IF array_length(v_expired,1) > 0 THEN
    hard := hard || jsonb_build_object('code','certification_expired','label','Expired certification',
      'detail',array_to_string(v_expired,', ')||' expired before this shift date.');
  END IF;
  SELECT ARRAY(SELECT certification_name FROM public.caregiver_certifications
               WHERE caregiver_id=_caregiver_id AND is_verified IS NOT TRUE)
    INTO v_unverified;
  IF array_length(v_unverified,1) > 0 THEN
    hard := hard || jsonb_build_object('code','certification_unverified','label','Unverified certification',
      'detail',array_to_string(v_unverified,', ')||' has not been verified.');
  END IF;

  FOR r IN
    SELECT o.id, o.start_time, o.end_time
    FROM public.shift_assignments a
    JOIN public.shifts o ON o.id = a.shift_id
    WHERE a.caregiver_id = _caregiver_id AND a.status <> 'cancelled'
      AND o.shift_date = s.shift_date AND o.id <> s.id
  LOOP
    IF s.start_time < r.end_time AND r.start_time < s.end_time THEN
      hard := hard || jsonb_build_object('code','double_booked','label','Double booked',
        'detail','Overlaps a shift '||to_char(r.start_time,'HH24:MI')||'-'||to_char(r.end_time,'HH24:MI')||' on this day.');
    ELSIF s.start_time < r.end_time + make_interval(mins => v_buffer)
      AND r.start_time < s.end_time + make_interval(mins => v_buffer) THEN
      adv := adv || jsonb_build_object('code','travel_buffer','label','Tight turnaround',
        'detail','Less than '||v_buffer||' minutes between this and a shift at '||to_char(r.start_time,'HH24:MI')||'.');
    END IF;
  END LOOP;

  v_week_start := (date_trunc('week', s.shift_date::timestamp))::date;
  v_week_end := v_week_start + 6;
  SELECT COALESCE(SUM(o.duration_hours),0) INTO v_weekly
  FROM public.shift_assignments a
  JOIN public.shifts o ON o.id = a.shift_id
  WHERE a.caregiver_id = _caregiver_id AND a.status <> 'cancelled'
    AND o.shift_date BETWEEN v_week_start AND v_week_end AND o.id <> s.id;
  v_projected := round((v_weekly + v_hours)::numeric, 2);

  IF v_projected > v_cap THEN
    soft := soft || jsonb_build_object('code','weekly_hours','label','Over weekly hours cap',
      'detail','Would reach '||v_projected||'h this week (cap '||v_cap||'h).');
  ELSIF v_projected > v_cap - 8 THEN
    adv := adv || jsonb_build_object('code','overtime_risk','label','Approaching overtime',
      'detail','Would reach '||v_projected||'h of '||v_cap||'h this week.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.time_off_requests t
             WHERE t.caregiver_id=_caregiver_id AND t.status='approved'
               AND s.shift_date BETWEEN t.start_date AND t.end_date) THEN
    soft := soft || jsonb_build_object('code','time_off','label','Approved time off',
      'detail','Caregiver has approved time off covering this date.');
  END IF;

  -- date-specific exception overrides the weekly rule for that date
  SELECT * INTO v_exc FROM public.caregiver_availability_exceptions
   WHERE caregiver_id=_caregiver_id AND exception_date = s.shift_date;

  IF FOUND THEN
    IF v_exc.is_available IS FALSE THEN
      soft := soft || jsonb_build_object('code','availability_exception','label','Unavailable on this date',
        'detail', COALESCE(NULLIF(v_exc.reason,''),'Caregiver marked this date as unavailable.'));
    ELSIF NOT (v_exc.start_time <= s.start_time AND v_exc.end_time >= s.end_time) THEN
      soft := soft || jsonb_build_object('code','availability_exception','label','Outside availability for this date',
        'detail','On this date the caregiver is only available '||to_char(v_exc.start_time,'HH24:MI')||'-'||to_char(v_exc.end_time,'HH24:MI')||'.');
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_avail_rows FROM public.caregiver_availability WHERE caregiver_id=_caregiver_id;
    IF v_avail_rows > 0 THEN
      v_dow := EXTRACT(DOW FROM s.shift_date)::int;
      SELECT EXISTS (
        SELECT 1 FROM public.caregiver_availability av
        WHERE av.caregiver_id=_caregiver_id AND av.day_of_week=v_dow AND av.is_available IS NOT FALSE
          AND av.start_time <= s.start_time AND av.end_time >= s.end_time
      ) INTO v_covered;
      IF NOT v_covered THEN
        soft := soft || jsonb_build_object('code','availability','label','Outside declared availability',
          'detail','This shift falls outside the caregiver''s availability for that weekday.');
      END IF;
    END IF;
  END IF;

  SELECT * INTO cl FROM public.clients WHERE id = s.client_id;
  IF cl.zip_code IS NOT NULL AND cg.service_zipcodes IS NOT NULL AND array_length(cg.service_zipcodes,1) > 0
     AND NOT (cl.zip_code = ANY(cg.service_zipcodes)) THEN
    adv := adv || jsonb_build_object('code','service_area','label','Outside service area',
      'detail','Client ZIP '||cl.zip_code||' is not in this caregiver''s service ZIP list.');
  END IF;
  IF cl.preferred_caregiver_id IS NOT NULL AND cl.preferred_caregiver_id <> _caregiver_id THEN
    adv := adv || jsonb_build_object('code','preferred_caregiver','label','Client has a preferred caregiver',
      'detail','Continuity of care: the client requested a specific caregiver.');
  END IF;

  SELECT * INTO svc FROM public.care_types WHERE code = s.care_type_code;
  IF svc.requires_trade_approval THEN
    adv := adv || jsonb_build_object('code','specialized_service','label','Specialised care service',
      'detail',COALESCE(svc.name,s.care_type_code)||' requires manager approval before a trade.');
  END IF;

  v_hours_until := EXTRACT(EPOCH FROM ((s.shift_date + s.start_time) - now()))/3600.0;
  IF v_hours_until > 0 AND v_hours_until < v_late THEN
    adv := adv || jsonb_build_object('code','late_trade','label','Late assignment',
      'detail','Shift starts in under '||v_late||' hours.');
  END IF;
  IF s.status = 'in_progress' THEN
    adv := adv || jsonb_build_object('code','in_progress','label','Shift in progress','detail','This shift has already started.');
  END IF;
  IF cg.reliability_score IS NOT NULL AND cg.reliability_score < 70 THEN
    adv := adv || jsonb_build_object('code','reliability','label','Low reliability score',
      'detail','Reliability score is '||cg.reliability_score||'.');
  END IF;

  RETURN jsonb_build_object(
    'eligible', jsonb_array_length(hard) = 0,
    'auto_approvable', jsonb_array_length(hard) = 0 AND jsonb_array_length(soft) = 0,
    'hard', hard, 'soft', soft, 'advisory', adv,
    'weekly_hours', round(v_weekly::numeric,2), 'projected_weekly_hours', v_projected);
END;
$function$;