
CREATE OR REPLACE FUNCTION public.protect_completed_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed'::assignment_status THEN
    -- Only the demo purge path may remove demo completed rows.
    IF COALESCE(OLD.is_demo, false)
       AND COALESCE(current_setting('caremuch.purge_ctx', true), '') = '1' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Completed shift assignments are historical records and cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_demo_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb := '{}'::jsonb;
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'system_admin'::app_role) THEN
    RAISE EXCEPTION 'Only platform administrators may purge demo data' USING ERRCODE='42501';
  END IF;

  PERFORM set_config('caremuch.purge_ctx', '1', true);

  DELETE FROM public.shift_trades WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shift_trades', n);
  DELETE FROM public.shift_ratings WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shift_ratings', n);
  DELETE FROM public.shift_assignments WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shift_assignments', n);
  DELETE FROM public.shifts WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('shifts', n);
  DELETE FROM public.client_care_needs WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('client_care_needs', n);
  DELETE FROM public.order_services WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('order_services', n);
  DELETE FROM public.client_orders WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('client_orders', n);
  DELETE FROM public.caregiver_skills WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregiver_skills', n);
  DELETE FROM public.caregiver_availability WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregiver_availability', n);
  DELETE FROM public.caregiver_certifications WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregiver_certifications', n);
  DELETE FROM public.time_off_requests WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('time_off_requests', n);
  DELETE FROM public.clients WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('clients', n);
  -- real-login caregivers are is_demo = false and are never touched
  DELETE FROM public.caregivers WHERE is_demo AND user_id IS NULL; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('caregivers', n);

  PERFORM set_config('caremuch.purge_ctx', '0', true);
  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_demo_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_demo_data() TO service_role;
