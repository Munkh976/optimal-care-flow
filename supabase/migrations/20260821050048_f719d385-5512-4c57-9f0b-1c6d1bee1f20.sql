CREATE OR REPLACE FUNCTION public.release_shift_assignments(_shift_ids uuid[], _reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     SET status = 'unassigned'
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
$$;

REVOKE ALL ON FUNCTION public.release_shift_assignments(uuid[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.release_shift_assignments(uuid[], text) TO authenticated;