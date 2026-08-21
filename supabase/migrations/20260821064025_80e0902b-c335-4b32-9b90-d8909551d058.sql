
CREATE TABLE IF NOT EXISTS public.demo_purge_audit (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  dry_run boolean not null default true,
  result jsonb not null
);
GRANT SELECT ON public.demo_purge_audit TO authenticated;
GRANT ALL ON public.demo_purge_audit TO service_role;
ALTER TABLE public.demo_purge_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read purge audit" ON public.demo_purge_audit
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'system_admin'::app_role));

CREATE OR REPLACE FUNCTION public.purge_demo_data_dry_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
  payload jsonb;
BEGIN
  BEGIN
    PERFORM set_config('caremuch.purge_ctx', '1', true);
    -- same order as purge_demo_data(), executed inside a subtransaction that is rolled back
    res := jsonb_build_object();
    DECLARE n integer;
    BEGIN
      DELETE FROM public.shift_trades WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shift_trades', n);
      DELETE FROM public.shift_ratings WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shift_ratings', n);
      DELETE FROM public.shift_assignments WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shift_assignments', n);
      DELETE FROM public.shifts WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('shifts', n);
      DELETE FROM public.client_care_needs WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('client_care_needs', n);
      DELETE FROM public.order_services WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('order_services', n);
      DELETE FROM public.client_orders WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('client_orders', n);
      DELETE FROM public.caregiver_skills WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_skills', n);
      DELETE FROM public.caregiver_availability WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_availability', n);
      DELETE FROM public.caregiver_certifications WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_certifications', n);
      DELETE FROM public.time_off_requests WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('time_off_requests', n);
      DELETE FROM public.clients WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('clients', n);
      DELETE FROM public.caregivers WHERE is_demo AND user_id IS NULL; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregivers', n);
    END;
    res := res || jsonb_build_object(
      'survivors', jsonb_build_object(
        'caregivers_with_login', (SELECT count(*) FROM public.caregivers WHERE user_id IS NOT NULL),
        'caregivers_total', (SELECT count(*) FROM public.caregivers),
        'clients_total', (SELECT count(*) FROM public.clients),
        'shifts_total', (SELECT count(*) FROM public.shifts),
        'shift_assignments_total', (SELECT count(*) FROM public.shift_assignments),
        'time_off_total', (SELECT count(*) FROM public.time_off_requests),
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
$$;
REVOKE ALL ON FUNCTION public.purge_demo_data_dry_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_demo_data_dry_run() TO service_role;

SELECT public.purge_demo_data_dry_run();
