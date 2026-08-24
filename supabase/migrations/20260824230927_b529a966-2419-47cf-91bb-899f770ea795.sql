-- 1. Events table -----------------------------------------------------------
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  virtual_office_id uuid REFERENCES public.virtual_office(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  subject_type text NOT NULL,
  subject_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_event_type_check CHECK (event_type IN (
    'caregiver_application_received','caregiver_approved','caregiver_rejected',
    'care_request_received','care_request_converted_to_client',
    'shift_created','shift_assigned','shift_filled','shift_completed','shift_cancelled','shift_no_show',
    'caregiver_pickup','assignment_released','rating_added',
    'time_entry_submitted','time_entry_approved','earnings_computed'
  )),
  CONSTRAINT events_actor_type_check CHECK (actor_type IN ('staff','caregiver','client','system','anon'))
);

CREATE INDEX events_agency_type_time_idx ON public.events (agency_id, event_type, occurred_at DESC);
CREATE INDEX events_subject_idx ON public.events (subject_type, subject_id, occurred_at);
CREATE INDEX events_agency_time_idx ON public.events (agency_id, occurred_at DESC);
CREATE INDEX events_agency_real_time_idx ON public.events (agency_id, occurred_at DESC) WHERE is_demo = false;

-- Read-only for authenticated (RLS narrows further); writes only via SECURITY DEFINER.
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
REVOKE ALL ON public.events FROM anon;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read all events"
  ON public.events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'system_admin'::app_role));

CREATE POLICY "Agency staff read own agency events"
  ON public.events FOR SELECT TO authenticated
  USING (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id());

-- No INSERT/UPDATE/DELETE policies: append-only, written only by SECURITY DEFINER code.

-- 2. Non-blocking logging helper --------------------------------------------
CREATE OR REPLACE FUNCTION public.log_event(
  _agency_id uuid,
  _event_type text,
  _actor_type text DEFAULT 'system',
  _actor_id uuid DEFAULT NULL,
  _subject_type text DEFAULT 'unknown',
  _subject_id uuid DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb,
  _virtual_office_id uuid DEFAULT NULL,
  _is_demo boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _agency_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.events(agency_id, virtual_office_id, event_type, actor_type, actor_id,
                            subject_type, subject_id, payload, is_demo)
  VALUES (_agency_id, _virtual_office_id, _event_type, COALESCE(_actor_type,'system'), _actor_id,
          COALESCE(_subject_type,'unknown'), _subject_id, COALESCE(_payload,'{}'::jsonb), COALESCE(_is_demo,false));
EXCEPTION WHEN OTHERS THEN
  -- Best effort: event logging must never break the underlying operation.
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.log_event(uuid,text,text,uuid,text,uuid,jsonb,uuid,boolean) FROM PUBLIC, anon, authenticated;

-- Resolve the acting party for triggers.
CREATE OR REPLACE FUNCTION public.event_actor_type()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'anon'
    WHEN public.is_agency_staff(auth.uid()) THEN 'staff'
    WHEN EXISTS (SELECT 1 FROM public.caregivers c WHERE c.user_id = auth.uid()) THEN 'caregiver'
    WHEN EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = auth.uid()) THEN 'client'
    ELSE 'system' END;
$$;

-- Fallback agency for unscoped public submissions.
CREATE OR REPLACE FUNCTION public.event_default_agency_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.id FROM public.agency a
  WHERE a.is_active AND a.id <> '00000000-0000-0000-0000-000000000000'::uuid
  ORDER BY a.created_at LIMIT 1;
$$;

-- 3. Triggers ----------------------------------------------------------------
-- caregiver_registrations: application received / approved / rejected
CREATE OR REPLACE FUNCTION public.tg_event_caregiver_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_agency uuid;
BEGIN
  v_agency := COALESCE(NEW.agency_id, public.event_default_agency_id());
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event(v_agency, 'caregiver_application_received', public.event_actor_type(), auth.uid(),
      'caregiver_registration', NEW.id,
      jsonb_build_object('status', NEW.status, 'care_type_codes', to_jsonb(NEW.care_type_codes)),
      NEW.virtual_office_id, false);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.log_event(v_agency, 'caregiver_approved', public.event_actor_type(), COALESCE(NEW.reviewed_by, auth.uid()),
        'caregiver_registration', NEW.id, jsonb_build_object('previous_status', OLD.status), NEW.virtual_office_id, false);
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.log_event(v_agency, 'caregiver_rejected', public.event_actor_type(), COALESCE(NEW.reviewed_by, auth.uid()),
        'caregiver_registration', NEW.id, jsonb_build_object('previous_status', OLD.status), NEW.virtual_office_id, false);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_event_caregiver_registration
AFTER INSERT OR UPDATE ON public.caregiver_registrations
FOR EACH ROW EXECUTE FUNCTION public.tg_event_caregiver_registration();

-- care_requests: received (INSERT, exactly one per row) / converted (client_id first set)
CREATE OR REPLACE FUNCTION public.tg_event_care_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event(NEW.agency_id, 'care_request_received', public.event_actor_type(), auth.uid(),
      'care_request', NEW.id,
      jsonb_build_object('source', NEW.source, 'status', NEW.status, 'priority', NEW.priority),
      NEW.virtual_office_id, NEW.is_demo);
  ELSIF TG_OP = 'UPDATE' AND OLD.client_id IS NULL AND NEW.client_id IS NOT NULL THEN
    PERFORM public.log_event(NEW.agency_id, 'care_request_converted_to_client', public.event_actor_type(), auth.uid(),
      'care_request', NEW.id,
      jsonb_build_object('client_id', NEW.client_id, 'family_id', NEW.family_id),
      NEW.virtual_office_id, NEW.is_demo);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_event_care_request
AFTER INSERT OR UPDATE ON public.care_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_event_care_request();

-- shifts: created / completed / cancelled ONLY (never on the assignment-driven
-- open->assigned transition, which the explicit shift_filled event already covers)
CREATE OR REPLACE FUNCTION public.tg_event_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_event(NEW.agency_id, 'shift_created', public.event_actor_type(), auth.uid(),
      'shift', NEW.id,
      jsonb_build_object('shift_date', NEW.shift_date, 'care_type_code', NEW.care_type_code,
                         'duration_hours', NEW.duration_hours, 'status', NEW.status,
                         'client_id', NEW.client_id, 'order_id', NEW.order_id),
      NULL, NEW.is_demo);
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status IS DISTINCT FROM OLD.status
        AND NEW.status IN ('completed','cancelled')
        AND COALESCE(current_setting('caremuch.assignment_ctx', true), '') <> '1' THEN
    PERFORM public.log_event(NEW.agency_id,
      CASE WHEN NEW.status = 'completed' THEN 'shift_completed' ELSE 'shift_cancelled' END,
      public.event_actor_type(), auth.uid(), 'shift', NEW.id,
      jsonb_build_object('previous_status', OLD.status, 'shift_date', NEW.shift_date,
                         'duration_hours', NEW.duration_hours, 'client_id', NEW.client_id),
      NULL, NEW.is_demo);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_event_shift
AFTER INSERT OR UPDATE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.tg_event_shift();

-- shift_ratings: rating added
CREATE OR REPLACE FUNCTION public.tg_event_shift_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.log_event(NEW.agency_id, 'rating_added', public.event_actor_type(), COALESCE(NEW.created_by, auth.uid()),
    'shift_rating', NEW.id,
    jsonb_build_object('rating', NEW.rating, 'shift_id', NEW.shift_id, 'caregiver_id', NEW.caregiver_id,
                       'client_id', NEW.client_id),
    NULL, NEW.is_demo);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_event_shift_rating
AFTER INSERT ON public.shift_ratings
FOR EACH ROW EXECUTE FUNCTION public.tg_event_shift_rating();

-- time_entries: submitted / approved
CREATE OR REPLACE FUNCTION public.tg_event_time_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'submitted' THEN v_type := 'time_entry_submitted';
    ELSIF NEW.status = 'approved' THEN v_type := 'time_entry_approved';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'submitted' THEN v_type := 'time_entry_submitted';
    ELSIF NEW.status = 'approved' THEN v_type := 'time_entry_approved';
    END IF;
  END IF;

  IF v_type IS NOT NULL THEN
    PERFORM public.log_event(NEW.agency_id, v_type, public.event_actor_type(), auth.uid(),
      'time_entry', NEW.id,
      jsonb_build_object('shift_id', NEW.shift_id, 'caregiver_id', NEW.caregiver_id,
                         'hours_worked', NEW.hours_worked, 'source', NEW.source),
      NULL, NEW.is_demo);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_event_time_entry
AFTER INSERT OR UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_event_time_entry();

-- earnings_lines: computed
CREATE OR REPLACE FUNCTION public.tg_event_earnings_line()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.log_event(NEW.agency_id, 'earnings_computed', public.event_actor_type(), COALESCE(NEW.computed_by, auth.uid()),
    'earnings_line', NEW.id,
    jsonb_build_object('shift_id', NEW.shift_id, 'caregiver_id', NEW.caregiver_id,
                       'gross_amount', NEW.gross_amount, 'hours_used', NEW.hours_used),
    NULL, NEW.is_demo);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_event_earnings_line
AFTER INSERT ON public.earnings_lines
FOR EACH ROW EXECUTE FUNCTION public.tg_event_earnings_line();

-- 4. Explicit emission from authoritative functions ---------------------------
CREATE OR REPLACE FUNCTION public.assign_caregiver_to_shift(_shift_id uuid, _caregiver_id uuid, _method assignment_method DEFAULT 'manual'::assignment_method, _notes text DEFAULT NULL::text, _override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM public.log_event(s.agency_id, 'shift_assigned', 'staff', auth.uid(), 'shift_assignment', v_id,
    jsonb_build_object('shift_id', _shift_id, 'caregiver_id', _caregiver_id,
                       'method', _method::text, 'overridden', v_override), NULL, s.is_demo);
  PERFORM public.log_event(s.agency_id, 'shift_filled', 'staff', auth.uid(), 'shift', _shift_id,
    jsonb_build_object('assignment_id', v_id, 'caregiver_id', _caregiver_id,
                       'method', _method::text, 'shift_created_at', s.created_at), NULL, s.is_demo);

  RETURN jsonb_build_object('assignment_id', v_id, 'overridden', v_override, 'eligibility', elig);
END;
$function$;

CREATE OR REPLACE FUNCTION public.caregiver_pick_up_shift(_shift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_cg uuid; elig jsonb; s record; v_id uuid;
BEGIN
  SELECT id INTO v_cg FROM public.caregivers WHERE user_id = auth.uid() LIMIT 1;
  IF v_cg IS NULL THEN RAISE EXCEPTION 'No caregiver profile for this user' USING ERRCODE='42501'; END IF;

  SELECT * INTO s FROM public.shifts WHERE id=_shift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shift not found' USING ERRCODE='P0002'; END IF;
  IF s.status NOT IN ('open','unassigned') THEN
    RAISE EXCEPTION 'Shift is not open for pick-up' USING ERRCODE='23514';
  END IF;
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

  PERFORM public.log_event(s.agency_id, 'caregiver_pickup', 'caregiver', auth.uid(), 'shift', _shift_id,
    jsonb_build_object('assignment_id', v_id, 'caregiver_id', v_cg), NULL, s.is_demo);
  PERFORM public.log_event(s.agency_id, 'shift_filled', 'caregiver', auth.uid(), 'shift', _shift_id,
    jsonb_build_object('assignment_id', v_id, 'caregiver_id', v_cg,
                       'method', 'picked_up', 'shift_created_at', s.created_at), NULL, s.is_demo);

  RETURN jsonb_build_object('assignment_id', v_id, 'eligibility', elig);
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_shift_assignments(_shift_ids uuid[], _reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0; rel record;
BEGIN
  IF NOT public.is_agency_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only agency staff can release assignments' USING ERRCODE='42501';
  END IF;

  PERFORM set_config('caremuch.assignment_ctx','1',true);

  CREATE TEMP TABLE IF NOT EXISTS _released_events (
    assignment_id uuid, shift_id uuid, caregiver_id uuid, agency_id uuid, is_demo boolean
  ) ON COMMIT DROP;
  DELETE FROM _released_events;

  WITH target AS (
    SELECT a.id
    FROM public.shift_assignments a
    JOIN public.shifts s ON s.id = a.shift_id
    WHERE a.shift_id = ANY(_shift_ids)
      AND s.agency_id = public.current_agency_id()
      AND a.status NOT IN ('completed','cancelled')
  )
  UPDATE public.shift_assignments a
     SET status = 'cancelled',
         notes = COALESCE(NULLIF(btrim(_reason),''), a.notes)
    FROM target t
   WHERE a.id = t.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO _released_events(assignment_id, shift_id, caregiver_id, agency_id, is_demo)
  SELECT a.id, a.shift_id, a.caregiver_id, s.agency_id, s.is_demo
  FROM public.shift_assignments a
  JOIN public.shifts s ON s.id = a.shift_id
  WHERE a.shift_id = ANY(_shift_ids)
    AND s.agency_id = public.current_agency_id()
    AND a.status = 'cancelled';

  UPDATE public.shifts
     SET status = 'open'
   WHERE id = ANY(_shift_ids)
     AND agency_id = public.current_agency_id()
     AND status NOT IN ('completed','cancelled')
     AND NOT EXISTS (
       SELECT 1 FROM public.shift_assignments a
       WHERE a.shift_id = shifts.id AND a.status <> 'cancelled'
     );

  PERFORM set_config('caremuch.assignment_ctx','',true);

  IF v_count > 0 THEN
    FOR rel IN SELECT * FROM _released_events LOOP
      PERFORM public.log_event(rel.agency_id, 'assignment_released', 'staff', auth.uid(),
        'shift_assignment', rel.assignment_id,
        jsonb_build_object('shift_id', rel.shift_id, 'caregiver_id', rel.caregiver_id,
                           'reason', NULLIF(btrim(_reason),'')), NULL, rel.is_demo);
    END LOOP;
  END IF;

  RETURN v_count;
END;
$function$;

-- 5. Demo purge inclusion -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_demo_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r jsonb := '{}'::jsonb; n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'system_admin'::app_role) THEN
    RAISE EXCEPTION 'Only platform administrators may purge demo data' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('caremuch.purge_ctx', '1', true);
  DELETE FROM public.events WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('events', n);
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
$function$;

CREATE OR REPLACE FUNCTION public.purge_demo_data_dry_run()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE res jsonb; payload jsonb;
BEGIN
  BEGIN
    PERFORM set_config('caremuch.purge_ctx', '1', true);
    res := jsonb_build_object();
    DECLARE n integer;
    BEGIN
      DELETE FROM public.events WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('events', n);
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
        'events_total', (SELECT count(*) FROM public.events),
        'any_nondemo_deleted', false));
    payload := res;
    RAISE EXCEPTION 'DRY_RUN_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DRY_RUN_ROLLBACK' THEN RAISE; END IF;
  END;
  INSERT INTO public.demo_purge_audit(dry_run, result) VALUES (true, payload);
  RETURN payload;
END;
$function$;