CREATE OR REPLACE FUNCTION public.release_shift_assignments(_shift_ids uuid[], _reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count int := 0; rel record; v_released jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_agency_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only agency staff can release assignments' USING ERRCODE='42501';
  END IF;

  PERFORM set_config('caremuch.assignment_ctx','1',true);

  WITH target AS (
    SELECT a.id, s.agency_id, s.is_demo
    FROM public.shift_assignments a
    JOIN public.shifts s ON s.id = a.shift_id
    WHERE a.shift_id = ANY(_shift_ids)
      AND s.agency_id = public.current_agency_id()
      AND a.status NOT IN ('completed','cancelled')
  ), upd AS (
    UPDATE public.shift_assignments a
       SET status = 'cancelled',
           notes = COALESCE(NULLIF(btrim(_reason),''), a.notes)
      FROM target t
     WHERE a.id = t.id
    RETURNING a.id AS assignment_id, a.shift_id, a.caregiver_id, t.agency_id, t.is_demo
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(upd)), '[]'::jsonb), count(*) INTO v_released, v_count FROM upd;

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

  FOR rel IN SELECT * FROM jsonb_to_recordset(v_released)
    AS x(assignment_id uuid, shift_id uuid, caregiver_id uuid, agency_id uuid, is_demo boolean)
  LOOP
    PERFORM public.log_event(rel.agency_id, 'assignment_released', 'staff', auth.uid(),
      'shift_assignment', rel.assignment_id,
      jsonb_build_object('shift_id', rel.shift_id, 'caregiver_id', rel.caregiver_id,
                         'reason', NULLIF(btrim(_reason),'')), NULL, rel.is_demo);
  END LOOP;

  RETURN v_count;
END;
$function$;