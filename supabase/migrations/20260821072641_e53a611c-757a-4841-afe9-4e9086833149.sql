
-- ============ 2C-3: time_entries + earnings_lines ============
CREATE TYPE public.time_entry_status AS ENUM ('draft','submitted','approved','rejected');
CREATE TYPE public.time_entry_source AS ENUM ('clock','manual','correction','import');
CREATE TYPE public.earnings_rate_source AS ENUM ('shift','caregiver');
CREATE TYPE public.earnings_line_status AS ENUM ('calculated','voided');

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agency(id),
  shift_assignment_id uuid NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  hours_worked numeric(6,2) NOT NULL CHECK (hours_worked > 0),
  mileage numeric(8,2) CHECK (mileage IS NULL OR mileage >= 0),
  status public.time_entry_status NOT NULL DEFAULT 'draft',
  source public.time_entry_source NOT NULL DEFAULT 'manual',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  voided_at timestamptz,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_range_chk CHECK (ended_at > started_at)
);
CREATE INDEX idx_time_entries_assignment ON public.time_entries(shift_assignment_id);
CREATE INDEX idx_time_entries_caregiver ON public.time_entries(caregiver_id, started_at);
CREATE INDEX idx_time_entries_agency_status ON public.time_entries(agency_id, status);

CREATE TABLE public.earnings_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agency(id),
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  shift_assignment_id uuid NOT NULL REFERENCES public.shift_assignments(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id),
  hours_used numeric(6,2) NOT NULL CHECK (hours_used > 0),
  rate_used numeric(8,2) NOT NULL CHECK (rate_used > 0),
  rate_source public.earnings_rate_source NOT NULL,
  regular_hours numeric(6,2) NOT NULL DEFAULT 0,
  overtime_hours numeric(6,2) NOT NULL DEFAULT 0,
  overtime_rate numeric(8,2),
  regular_amount numeric(10,2) NOT NULL DEFAULT 0,
  overtime_amount numeric(10,2) NOT NULL DEFAULT 0,
  gross_amount numeric(10,2) NOT NULL DEFAULT 0,
  status public.earnings_line_status NOT NULL DEFAULT 'calculated',
  computed_at timestamptz NOT NULL DEFAULT now(),
  computed_by uuid REFERENCES auth.users(id),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_earnings_line_live ON public.earnings_lines(time_entry_id) WHERE status = 'calculated';
CREATE INDEX idx_earnings_lines_caregiver ON public.earnings_lines(caregiver_id);
CREATE INDEX idx_earnings_lines_agency ON public.earnings_lines(agency_id, computed_at);

-- updated_at
CREATE TRIGGER trg_time_entries_updated BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_earnings_lines_updated BEFORE UPDATE ON public.earnings_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- integrity: derive keys + hours, block overlaps ----------
CREATE OR REPLACE FUNCTION public.time_entry_normalize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT sa.caregiver_id, sa.shift_id, s.agency_id
    INTO a
  FROM public.shift_assignments sa
  JOIN public.shifts s ON s.id = sa.shift_id
  WHERE sa.id = NEW.shift_assignment_id;
  IF a IS NULL THEN
    RAISE EXCEPTION 'Unknown shift assignment' USING ERRCODE='23503';
  END IF;
  NEW.caregiver_id := a.caregiver_id;
  NEW.shift_id := a.shift_id;
  NEW.agency_id := a.agency_id;
  NEW.hours_worked := ROUND(GREATEST(
      (EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 3600.0) - (COALESCE(NEW.break_minutes,0) / 60.0), 0)::numeric, 2);
  IF NEW.hours_worked <= 0 THEN
    RAISE EXCEPTION 'Time entry resolves to zero or negative hours';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.time_entries t
    WHERE t.shift_assignment_id = NEW.shift_assignment_id
      AND t.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND t.voided_at IS NULL
      AND tstzrange(t.started_at, t.ended_at, '[)') && tstzrange(NEW.started_at, NEW.ended_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Overlapping time entry for this assignment';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_time_entry_normalize BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.time_entry_normalize();

-- caregivers may only touch their own draft rows / cannot self-approve
CREATE OR REPLACE FUNCTION public.time_entry_protect_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_agency_staff(auth.uid()) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft time entries can be edited by the caregiver' USING ERRCODE='42501';
    END IF;
    IF NEW.status NOT IN ('draft','submitted') THEN
      RAISE EXCEPTION 'Caregivers may only submit their time entries' USING ERRCODE='42501';
    END IF;
  ELSIF TG_OP = 'INSERT' AND NEW.status <> 'draft' THEN
    RAISE EXCEPTION 'Caregiver time entries must start as draft' USING ERRCODE='42501';
  END IF;
  NEW.approved_by := CASE WHEN TG_OP='UPDATE' THEN OLD.approved_by ELSE NULL END;
  NEW.approved_at := CASE WHEN TG_OP='UPDATE' THEN OLD.approved_at ELSE NULL END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_time_entry_protect_approval BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.time_entry_protect_approval();

-- anti-drift: keep shift_assignments clock/hours columns derived
CREATE OR REPLACE FUNCTION public.sync_assignment_time_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE aid uuid;
BEGIN
  aid := COALESCE(NEW.shift_assignment_id, OLD.shift_assignment_id);
  UPDATE public.shift_assignments sa
  SET clock_in_time = agg.min_start,
      clock_out_time = agg.max_end,
      actual_hours_worked = agg.total_hours,
      mileage = agg.total_mileage
  FROM (
    SELECT min(t.started_at) AS min_start,
           max(t.ended_at) AS max_end,
           NULLIF(sum(t.hours_worked), 0) AS total_hours,
           NULLIF(sum(COALESCE(t.mileage,0)), 0) AS total_mileage
    FROM public.time_entries t
    WHERE t.shift_assignment_id = aid
      AND t.voided_at IS NULL
      AND t.status IN ('submitted','approved')
  ) agg
  WHERE sa.id = aid;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_sync_assignment_time_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_time_totals();

-- ---------- RLS ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
GRANT SELECT ON public.earnings_lines TO authenticated;
GRANT ALL ON public.earnings_lines TO service_role;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_staff_manage" ON public.time_entries FOR ALL TO authenticated
  USING (public.is_agency_staff(auth.uid()) AND (agency_id = public.current_agency_id() OR public.has_role(auth.uid(),'system_admin')))
  WITH CHECK (public.is_agency_staff(auth.uid()) AND (agency_id = public.current_agency_id() OR public.has_role(auth.uid(),'system_admin')));
CREATE POLICY "time_entries_caregiver_read_own" ON public.time_entries FOR SELECT TO authenticated
  USING (caregiver_id IN (SELECT public.my_caregiver_ids()));
CREATE POLICY "time_entries_caregiver_insert_own" ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (caregiver_id IN (SELECT public.my_caregiver_ids()) AND status = 'draft');
CREATE POLICY "time_entries_caregiver_update_own" ON public.time_entries FOR UPDATE TO authenticated
  USING (caregiver_id IN (SELECT public.my_caregiver_ids()) AND status = 'draft')
  WITH CHECK (caregiver_id IN (SELECT public.my_caregiver_ids()));

CREATE POLICY "earnings_lines_staff_read" ON public.earnings_lines FOR SELECT TO authenticated
  USING (public.is_agency_staff(auth.uid()) AND (agency_id = public.current_agency_id() OR public.has_role(auth.uid(),'system_admin')));
CREATE POLICY "earnings_lines_caregiver_read_own" ON public.earnings_lines FOR SELECT TO authenticated
  USING (caregiver_id IN (SELECT public.my_caregiver_ids()));
-- no INSERT/UPDATE/DELETE policy anywhere: only the definer functions write.

-- ---------- calculation ----------
CREATE OR REPLACE FUNCTION public.compute_earnings_for_time_entry(_time_entry_id uuid, _recompute boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  te record; rate numeric; src public.earnings_rate_source; existing uuid; new_id uuid; gross numeric;
BEGIN
  SELECT t.*, s.pay_rate, c.hourly_rate INTO te
  FROM public.time_entries t
  JOIN public.shifts s ON s.id = t.shift_id
  JOIN public.caregivers c ON c.id = t.caregiver_id
  WHERE t.id = _time_entry_id;
  IF te IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'skipped_reason', 'not_found');
  END IF;
  IF NOT (public.is_agency_staff(auth.uid())
          AND (te.agency_id = public.current_agency_id() OR public.has_role(auth.uid(),'system_admin'))) THEN
    RAISE EXCEPTION 'Only agency staff may compute earnings' USING ERRCODE='42501';
  END IF;
  IF te.status <> 'approved' OR te.voided_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'skipped_reason', 'not_approved');
  END IF;

  SELECT id INTO existing FROM public.earnings_lines WHERE time_entry_id = te.id AND status = 'calculated';
  IF existing IS NOT NULL AND NOT _recompute THEN
    RETURN jsonb_build_object('ok', true, 'earnings_line_id', existing, 'skipped_reason', 'already_calculated');
  END IF;

  IF te.pay_rate IS NOT NULL AND te.pay_rate > 0 THEN
    rate := te.pay_rate; src := 'shift';
  ELSIF te.hourly_rate IS NOT NULL AND te.hourly_rate > 0 THEN
    rate := te.hourly_rate; src := 'caregiver';
  ELSE
    RETURN jsonb_build_object('ok', false, 'skipped_reason', 'missing_rate');
  END IF;

  IF existing IS NOT NULL THEN
    UPDATE public.earnings_lines SET status = 'voided' WHERE id = existing;
  END IF;

  gross := ROUND(te.hours_worked * rate, 2);
  INSERT INTO public.earnings_lines (
    agency_id, time_entry_id, shift_assignment_id, shift_id, caregiver_id,
    hours_used, rate_used, rate_source, regular_hours, regular_amount,
    overtime_hours, overtime_amount, gross_amount, computed_by, is_demo)
  VALUES (te.agency_id, te.id, te.shift_assignment_id, te.shift_id, te.caregiver_id,
    te.hours_worked, rate, src, te.hours_worked, gross, 0, 0, gross, auth.uid(), te.is_demo)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'earnings_line_id', new_id, 'hours', te.hours_worked,
    'rate', rate, 'rate_source', src, 'gross', gross, 'recomputed', existing IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_earnings_batch(_agency_id uuid, _from date, _to date, _recompute boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; res jsonb; created int := 0; recomputed int := 0; skipped jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.is_agency_staff(auth.uid())
          AND (_agency_id = public.current_agency_id() OR public.has_role(auth.uid(),'system_admin'))) THEN
    RAISE EXCEPTION 'Only agency staff may compute earnings' USING ERRCODE='42501';
  END IF;
  FOR r IN
    SELECT id FROM public.time_entries
    WHERE agency_id = _agency_id AND status = 'approved' AND voided_at IS NULL
      AND started_at::date BETWEEN _from AND _to
    ORDER BY started_at
  LOOP
    res := public.compute_earnings_for_time_entry(r.id, _recompute);
    IF (res->>'ok')::boolean AND res ? 'gross' THEN
      IF COALESCE((res->>'recomputed')::boolean, false) THEN recomputed := recomputed + 1; ELSE created := created + 1; END IF;
    ELSIF res->>'skipped_reason' IS NOT NULL AND res->>'skipped_reason' <> 'already_calculated' THEN
      skipped := skipped || jsonb_build_object('time_entry_id', r.id, 'reason', res->>'skipped_reason');
    END IF;
  END LOOP;
  RETURN jsonb_build_object('created', created, 'recomputed', recomputed, 'skipped', skipped);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_earnings_for_time_entry(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.compute_earnings_batch(uuid, date, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_earnings_for_time_entry(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_earnings_batch(uuid, date, date, boolean) TO authenticated, service_role;

-- ---------- backfill from existing assignment clock data ----------
INSERT INTO public.time_entries (agency_id, shift_assignment_id, shift_id, caregiver_id,
  started_at, ended_at, break_minutes, hours_worked, status, source, approved_at, is_demo)
SELECT s.agency_id, sa.id, sa.shift_id, sa.caregiver_id,
  sa.clock_in_time, sa.clock_out_time, 0,
  COALESCE(sa.actual_hours_worked, ROUND((EXTRACT(EPOCH FROM (sa.clock_out_time - sa.clock_in_time))/3600.0)::numeric,2)),
  'approved', 'import', now(), sa.is_demo
FROM public.shift_assignments sa
JOIN public.shifts s ON s.id = sa.shift_id
WHERE sa.clock_in_time IS NOT NULL AND sa.clock_out_time IS NOT NULL
  AND sa.clock_out_time > sa.clock_in_time;

-- ---------- purge order extension ----------
CREATE OR REPLACE FUNCTION public.purge_demo_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb := '{}'::jsonb; n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'system_admin'::app_role) THEN
    RAISE EXCEPTION 'Only platform administrators may purge demo data' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('caremuch.purge_ctx', '1', true);
  DELETE FROM public.earnings_lines WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('earnings_lines', n);
  DELETE FROM public.time_entries WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('time_entries', n);
  DELETE FROM public.shift_trades WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shift_trades', n);
  DELETE FROM public.shift_ratings WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shift_ratings', n);
  DELETE FROM public.shift_assignments WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shift_assignments', n);
  DELETE FROM public.shifts WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shifts', n);
  DELETE FROM public.care_requests WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('care_requests', n);
  DELETE FROM public.client_care_needs WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('client_care_needs', n);
  DELETE FROM public.order_services WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('order_services', n);
  DELETE FROM public.client_orders WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('client_orders', n);
  DELETE FROM public.caregiver_skills WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregiver_skills', n);
  DELETE FROM public.caregiver_availability WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregiver_availability', n);
  DELETE FROM public.caregiver_certifications WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregiver_certifications', n);
  DELETE FROM public.time_off_requests WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('time_off_requests', n);
  DELETE FROM public.clients WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('clients', n);
  DELETE FROM public.caregiver_preferences WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregiver_preferences', n);
  DELETE FROM public.caregivers WHERE is_demo AND user_id IS NULL; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregivers', n);
  DELETE FROM public.family_contacts WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('family_contacts', n);
  DELETE FROM public.families WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('families', n);
  DELETE FROM public.virtual_office WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('virtual_office', n);
  PERFORM set_config('caremuch.purge_ctx', '0', true);
  RETURN r;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_demo_data_dry_run()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb; payload jsonb;
BEGIN
  BEGIN
    PERFORM set_config('caremuch.purge_ctx', '1', true);
    res := jsonb_build_object();
    DECLARE n integer;
    BEGIN
      DELETE FROM public.earnings_lines WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('earnings_lines', n);
      DELETE FROM public.time_entries WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('time_entries', n);
      DELETE FROM public.shift_trades WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shift_trades', n);
      DELETE FROM public.shift_ratings WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shift_ratings', n);
      DELETE FROM public.shift_assignments WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shift_assignments', n);
      DELETE FROM public.shifts WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shifts', n);
      DELETE FROM public.care_requests WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('care_requests', n);
      DELETE FROM public.client_care_needs WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('client_care_needs', n);
      DELETE FROM public.order_services WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('order_services', n);
      DELETE FROM public.client_orders WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('client_orders', n);
      DELETE FROM public.caregiver_skills WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_skills', n);
      DELETE FROM public.caregiver_availability WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_availability', n);
      DELETE FROM public.caregiver_certifications WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_certifications', n);
      DELETE FROM public.time_off_requests WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('time_off_requests', n);
      DELETE FROM public.clients WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('clients', n);
      DELETE FROM public.caregiver_preferences WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_preferences', n);
      DELETE FROM public.caregivers WHERE is_demo AND user_id IS NULL; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregivers', n);
      DELETE FROM public.family_contacts WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('family_contacts', n);
      DELETE FROM public.families WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('families', n);
      DELETE FROM public.virtual_office WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('virtual_office', n);
    END;
    res := res || jsonb_build_object('survivors', jsonb_build_object(
        'caregivers_with_login', (SELECT count(*) FROM public.caregivers WHERE user_id IS NOT NULL),
        'caregivers_total', (SELECT count(*) FROM public.caregivers),
        'clients_total', (SELECT count(*) FROM public.clients),
        'shifts_total', (SELECT count(*) FROM public.shifts),
        'shift_assignments_total', (SELECT count(*) FROM public.shift_assignments),
        'time_entries_total', (SELECT count(*) FROM public.time_entries),
        'earnings_lines_total', (SELECT count(*) FROM public.earnings_lines),
        'time_off_total', (SELECT count(*) FROM public.time_off_requests),
        'families_total', (SELECT count(*) FROM public.families),
        'virtual_office_total', (SELECT count(*) FROM public.virtual_office),
        'care_requests_total', (SELECT count(*) FROM public.care_requests),
        'caregiver_preferences_total', (SELECT count(*) FROM public.caregiver_preferences),
        'any_nondemo_deleted', false));
    payload := res;
    RAISE EXCEPTION 'DRY_RUN_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DRY_RUN_ROLLBACK' THEN RAISE; END IF;
  END;
  INSERT INTO public.demo_purge_audit(dry_run, result) VALUES (true, payload);
  RETURN payload;
END;
$$;

COMMENT ON COLUMN public.shift_assignments.clock_in_time IS 'DERIVED from time_entries (2C-3). Do not write directly.';
COMMENT ON COLUMN public.shift_assignments.clock_out_time IS 'DERIVED from time_entries (2C-3). Do not write directly.';
COMMENT ON COLUMN public.shift_assignments.actual_hours_worked IS 'DERIVED from time_entries (2C-3). Do not write directly.';
