-- 2.5 Server-side scheduling & eligibility enforcement

CREATE OR REPLACE FUNCTION public.check_assignment_eligibility(_shift_id uuid, _caregiver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record; cg record; cl record; svc record; r record;
  hard jsonb := '[]'::jsonb; soft jsonb := '[]'::jsonb; adv jsonb := '[]'::jsonb;
  v_cap numeric := 40; v_buffer int := 30; v_late int := 24;
  v_week_start date; v_week_end date;
  v_weekly numeric := 0; v_projected numeric; v_hours numeric;
  v_missing text[]; v_expired text[]; v_unverified text[];
  v_avail_rows int; v_covered boolean; v_dow int;
  v_hours_until numeric;
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

  -- ===== HARD =====
  IF cg.agency_id IS DISTINCT FROM s.agency_id THEN
    hard := hard || jsonb_build_object('code','tenancy','label','Different agency','detail','Caregiver belongs to another agency.');
  END IF;

  IF cg.is_active IS FALSE THEN
    hard := hard || jsonb_build_object('code','inactive','label','Inactive caregiver','detail','This caregiver is not active.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shift_assignments a
    WHERE a.shift_id = _shift_id AND a.status <> 'cancelled'
      AND a.caregiver_id <> _caregiver_id
  ) THEN
    hard := hard || jsonb_build_object('code','shift_taken','label','Shift already assigned','detail','Another caregiver already holds this shift.');
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

  -- ===== SOFT =====
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

  -- ===== ADVISORY =====
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
$$;

REVOKE ALL ON FUNCTION public.check_assignment_eligibility(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.check_assignment_eligibility(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_caregiver_to_shift(
  _shift_id uuid,
  _caregiver_id uuid,
  _method assignment_method DEFAULT 'manual',
  _notes text DEFAULT NULL,
  _override_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elig jsonb; s record; existing record; v_id uuid; v_override boolean := false;
BEGIN
  IF NOT public.is_agency_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only agency staff can assign shifts' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM public.shifts WHERE id = _shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE='P0002'; END IF;
  IF s.agency_id IS DISTINCT FROM public.current_agency_id() THEN
    RAISE EXCEPTION 'Shift belongs to another agency' USING ERRCODE='42501';
  END IF;

  elig := public.check_assignment_eligibility(_shift_id, _caregiver_id);

  IF jsonb_array_length(elig->'hard') > 0 THEN
    RAISE EXCEPTION 'Assignment refused: %', (
      SELECT string_agg(x->>'detail', ' ') FROM jsonb_array_elements(elig->'hard') x
    ) USING ERRCODE='23514';
  END IF;

  IF jsonb_array_length(elig->'soft') > 0 THEN
    IF _override_reason IS NULL OR btrim(_override_reason) = '' THEN
      RAISE EXCEPTION 'Override reason required: %', (
        SELECT string_agg(x->>'detail', ' ') FROM jsonb_array_elements(elig->'soft') x
      ) USING ERRCODE='23514';
    END IF;
    v_override := true;
  END IF;

  PERFORM set_config('caremuch.assignment_ctx','1',true);

  SELECT * INTO existing FROM public.shift_assignments
   WHERE shift_id=_shift_id AND status NOT IN ('completed','cancelled') LIMIT 1;

  IF FOUND THEN
    UPDATE public.shift_assignments
       SET caregiver_id=_caregiver_id, status='scheduled', assignment_method=_method,
           notes=COALESCE(_notes,notes), assigned_at=now(),
           override_reason=CASE WHEN v_override THEN btrim(_override_reason) ELSE NULL END,
           override_by=CASE WHEN v_override THEN auth.uid() ELSE NULL END,
           override_at=CASE WHEN v_override THEN now() ELSE NULL END
     WHERE id=existing.id
     RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.shift_assignments(shift_id, caregiver_id, status, assignment_method, notes,
      override_reason, override_by, override_at)
    VALUES (_shift_id,_caregiver_id,'scheduled',_method,_notes,
      CASE WHEN v_override THEN btrim(_override_reason) END,
      CASE WHEN v_override THEN auth.uid() END,
      CASE WHEN v_override THEN now() END)
    RETURNING id INTO v_id;
  END IF;

  PERFORM set_config('caremuch.assignment_ctx','',true);
  RETURN jsonb_build_object('assignment_id', v_id, 'overridden', v_override, 'eligibility', elig);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_caregiver_to_shift(uuid,uuid,assignment_method,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.assign_caregiver_to_shift(uuid,uuid,assignment_method,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.caregiver_pick_up_shift(_shift_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cg uuid; elig jsonb; s record; v_id uuid;
BEGIN
  SELECT id INTO v_cg FROM public.caregivers WHERE user_id = auth.uid() LIMIT 1;
  IF v_cg IS NULL THEN RAISE EXCEPTION 'No caregiver profile for this user' USING ERRCODE='42501'; END IF;

  SELECT * INTO s FROM public.shifts WHERE id=_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE='P0002'; END IF;
  IF s.status <> 'open' THEN RAISE EXCEPTION 'Shift is not open for pick-up' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.shift_assignments a WHERE a.shift_id=_shift_id AND a.status<>'cancelled') THEN
    RAISE EXCEPTION 'Shift is already assigned' USING ERRCODE='23514';
  END IF;

  elig := public.check_assignment_eligibility(_shift_id, v_cg);
  IF jsonb_array_length(elig->'hard') > 0 OR jsonb_array_length(elig->'soft') > 0 THEN
    RAISE EXCEPTION 'Pick-up refused: %', (
      SELECT string_agg(x->>'detail',' ') FROM jsonb_array_elements((elig->'hard') || (elig->'soft')) x
    ) USING ERRCODE='23514';
  END IF;

  PERFORM set_config('caremuch.assignment_ctx','1',true);
  INSERT INTO public.shift_assignments(shift_id, caregiver_id, status, assignment_method)
  VALUES (_shift_id, v_cg, 'scheduled', 'picked_up') RETURNING id INTO v_id;
  PERFORM set_config('caremuch.assignment_ctx','',true);

  RETURN jsonb_build_object('assignment_id', v_id, 'eligibility', elig);
END;
$$;

REVOKE ALL ON FUNCTION public.caregiver_pick_up_shift(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.caregiver_pick_up_shift(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_assignment_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('caremuch.assignment_ctx', true),'') = '1' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Direct assignment inserts are not allowed; use assign_caregiver_to_shift()' USING ERRCODE='42501';
  END IF;
  IF NEW.caregiver_id IS DISTINCT FROM OLD.caregiver_id THEN
    RAISE EXCEPTION 'caregiver_id can only be changed through assign_caregiver_to_shift()' USING ERRCODE='42501';
  END IF;
  IF NEW.override_reason IS DISTINCT FROM OLD.override_reason
     OR NEW.override_by IS DISTINCT FROM OLD.override_by
     OR NEW.override_at IS DISTINCT FROM OLD.override_at THEN
    RAISE EXCEPTION 'Override fields are set by the assignment function only' USING ERRCODE='42501';
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelling an assignment must go through the assignment functions' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_assignment_columns ON public.shift_assignments;
CREATE TRIGGER trg_protect_assignment_columns
BEFORE INSERT OR UPDATE ON public.shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.protect_assignment_columns();

DROP POLICY IF EXISTS "Agency staff manage assignments in their agency" ON public.shift_assignments;

CREATE POLICY "Agency staff read assignments in their agency"
ON public.shift_assignments FOR SELECT TO authenticated
USING (public.is_agency_staff(auth.uid()) AND public.shift_assignment_agency_id(shift_id) = public.current_agency_id());

CREATE POLICY "Agency staff update operational fields"
ON public.shift_assignments FOR UPDATE TO authenticated
USING (public.is_agency_staff(auth.uid()) AND public.shift_assignment_agency_id(shift_id) = public.current_agency_id())
WITH CHECK (public.is_agency_staff(auth.uid()) AND public.shift_assignment_agency_id(shift_id) = public.current_agency_id());

REVOKE INSERT, DELETE ON public.shift_assignments FROM authenticated;
GRANT SELECT, UPDATE ON public.shift_assignments TO authenticated;
GRANT ALL ON public.shift_assignments TO service_role;

COMMENT ON COLUMN public.shift_assignments.override_reason IS
  'Set only by assign_caregiver_to_shift() when staff override a SOFT eligibility blocker.';