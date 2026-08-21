CREATE OR REPLACE FUNCTION public.purge_demo_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- real-login caregivers are is_demo = false and are never touched
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
DECLARE
  res jsonb;
  payload jsonb;
BEGIN
  BEGIN
    PERFORM set_config('caremuch.purge_ctx', '1', true);
    res := jsonb_build_object();
    DECLARE n integer;
    BEGIN
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
    res := res || jsonb_build_object(
      'survivors', jsonb_build_object(
        'caregivers_with_login', (SELECT count(*) FROM public.caregivers WHERE user_id IS NOT NULL),
        'caregivers_total', (SELECT count(*) FROM public.caregivers),
        'clients_total', (SELECT count(*) FROM public.clients),
        'shifts_total', (SELECT count(*) FROM public.shifts),
        'shift_assignments_total', (SELECT count(*) FROM public.shift_assignments),
        'time_off_total', (SELECT count(*) FROM public.time_off_requests),
        'families_total', (SELECT count(*) FROM public.families),
        'virtual_office_total', (SELECT count(*) FROM public.virtual_office),
        'care_requests_total', (SELECT count(*) FROM public.care_requests),
        'caregiver_preferences_total', (SELECT count(*) FROM public.caregiver_preferences),
        'any_nondemo_deleted', false
      )
    );
    payload := res;
    RAISE EXCEPTION 'DRY_RUN_ROLLBACK';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'DRY_RUN_ROLLBACK' THEN
      RAISE;
    END IF;
  END;
  INSERT INTO public.demo_purge_audit(dry_run, result) VALUES (true, payload);
  RETURN payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.purge_demo_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_demo_data_dry_run() FROM PUBLIC, anon, authenticated;
