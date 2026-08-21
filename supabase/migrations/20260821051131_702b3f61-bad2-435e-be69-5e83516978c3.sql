CREATE OR REPLACE FUNCTION public.release_shift_assignments(_shift_ids uuid[], _reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE v_count int := 0;
BEGIN
  IF NOT public.is_agency_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only agency staff can release assignments' USING ERRCODE='42501';
  END IF;

  PERFORM set_config('caremuch.assignment_ctx','1',true);

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
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.caregiver_pick_up_shift(_shift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
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

  RETURN jsonb_build_object('assignment_id', v_id, 'eligibility', elig);
END;
$function$;

REVOKE ALL ON FUNCTION public.release_shift_assignments(uuid[],text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_shift_assignments(uuid[],text) TO authenticated;
REVOKE ALL ON FUNCTION public.caregiver_pick_up_shift(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.caregiver_pick_up_shift(uuid) TO authenticated;