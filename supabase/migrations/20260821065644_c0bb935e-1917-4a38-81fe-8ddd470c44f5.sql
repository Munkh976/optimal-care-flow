-- ============ VIRTUAL OFFICE ============
CREATE TABLE public.virtual_office (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/New_York',
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  service_states text[] NOT NULL DEFAULT '{}',
  service_zipcodes text[] NOT NULL DEFAULT '{}',
  service_area jsonb NOT NULL DEFAULT '{}'::jsonb,
  operating_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_weekly_hours integer,
  travel_buffer_minutes integer,
  late_trade_hours integer,
  smart_match_weights jsonb,
  contact_email text,
  contact_phone text,
  address text,
  city text,
  state text,
  zip_code text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT virtual_office_agency_name_key UNIQUE (agency_id, name)
);
CREATE UNIQUE INDEX virtual_office_one_primary_per_agency
  ON public.virtual_office (agency_id) WHERE is_primary;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_office TO authenticated;
GRANT ALL ON public.virtual_office TO service_role;
ALTER TABLE public.virtual_office ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vo_select_same_agency" ON public.virtual_office
  FOR SELECT TO authenticated
  USING (agency_id = public.current_agency_id() OR public.has_role(auth.uid(), 'system_admin'::app_role));
CREATE POLICY "vo_insert_staff" ON public.virtual_office
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
              OR public.has_role(auth.uid(), 'system_admin'::app_role));
CREATE POLICY "vo_update_staff" ON public.virtual_office
  FOR UPDATE TO authenticated
  USING ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
         OR public.has_role(auth.uid(), 'system_admin'::app_role))
  WITH CHECK ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
              OR public.has_role(auth.uid(), 'system_admin'::app_role));
CREATE POLICY "vo_delete_staff" ON public.virtual_office
  FOR DELETE TO authenticated
  USING ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
         OR public.has_role(auth.uid(), 'system_admin'::app_role));

CREATE TRIGGER update_virtual_office_updated_at BEFORE UPDATE ON public.virtual_office
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FAMILIES ============
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  virtual_office_id uuid REFERENCES public.virtual_office(id) ON DELETE SET NULL,
  family_name text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LINK COLUMNS ON EXISTING TABLES (nullable, additive) ============
ALTER TABLE public.clients
  ADD COLUMN family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  ADD COLUMN virtual_office_id uuid REFERENCES public.virtual_office(id) ON DELETE SET NULL;
ALTER TABLE public.caregivers
  ADD COLUMN virtual_office_id uuid REFERENCES public.virtual_office(id) ON DELETE SET NULL;

CREATE POLICY "families_select_agency_or_own" ON public.families
  FOR SELECT TO authenticated
  USING (
    agency_id = public.current_agency_id()
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
    OR id IN (SELECT c.family_id FROM public.clients c WHERE c.id IN (SELECT public.my_client_ids()))
  );
CREATE POLICY "families_insert_staff" ON public.families
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
              OR public.has_role(auth.uid(), 'system_admin'::app_role));
CREATE POLICY "families_update_staff" ON public.families
  FOR UPDATE TO authenticated
  USING ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
         OR public.has_role(auth.uid(), 'system_admin'::app_role))
  WITH CHECK ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
              OR public.has_role(auth.uid(), 'system_admin'::app_role));
CREATE POLICY "families_delete_staff" ON public.families
  FOR DELETE TO authenticated
  USING ((public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
         OR public.has_role(auth.uid(), 'system_admin'::app_role));

-- ============ FAMILY CONTACTS ============
CREATE TABLE public.family_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  is_decision_maker boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_contacts TO authenticated;
GRANT ALL ON public.family_contacts TO service_role;
ALTER TABLE public.family_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.family_agency_id(_family_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agency_id FROM public.families WHERE id = _family_id
$$;

CREATE POLICY "family_contacts_select" ON public.family_contacts
  FOR SELECT TO authenticated
  USING (
    public.family_agency_id(family_id) = public.current_agency_id()
    OR public.has_role(auth.uid(), 'system_admin'::app_role)
    OR user_id = auth.uid()
  );
CREATE POLICY "family_contacts_insert_staff" ON public.family_contacts
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_agency_staff(auth.uid()) AND public.family_agency_id(family_id) = public.current_agency_id())
              OR public.has_role(auth.uid(), 'system_admin'::app_role));
CREATE POLICY "family_contacts_update_staff" ON public.family_contacts
  FOR UPDATE TO authenticated
  USING ((public.is_agency_staff(auth.uid()) AND public.family_agency_id(family_id) = public.current_agency_id())
         OR public.has_role(auth.uid(), 'system_admin'::app_role))
  WITH CHECK ((public.is_agency_staff(auth.uid()) AND public.family_agency_id(family_id) = public.current_agency_id())
              OR public.has_role(auth.uid(), 'system_admin'::app_role));
CREATE POLICY "family_contacts_delete_staff" ON public.family_contacts
  FOR DELETE TO authenticated
  USING ((public.is_agency_staff(auth.uid()) AND public.family_agency_id(family_id) = public.current_agency_id())
         OR public.has_role(auth.uid(), 'system_admin'::app_role));

CREATE TRIGGER update_family_contacts_updated_at BEFORE UPDATE ON public.family_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ BACKFILLS ============
INSERT INTO public.virtual_office (agency_id, name, code, is_primary, is_demo, city, state, zip_code, address)
SELECT a.id, 'Primary Office', 'PRIMARY', true, false, a.city, a.state, a.zip_code, a.address
FROM public.agency a;

INSERT INTO public.families (agency_id, virtual_office_id, family_name, is_demo)
SELECT c.agency_id, vo.id, c.last_name || ' Family', c.is_demo
FROM public.clients c
JOIN public.virtual_office vo ON vo.agency_id = c.agency_id AND vo.is_primary
WHERE c.family_id IS NULL;

UPDATE public.clients c
SET family_id = f.id,
    virtual_office_id = f.virtual_office_id
FROM public.families f
WHERE f.agency_id = c.agency_id
  AND f.family_name = c.last_name || ' Family'
  AND c.family_id IS NULL;

UPDATE public.caregivers g
SET virtual_office_id = vo.id
FROM public.virtual_office vo
WHERE vo.agency_id = g.agency_id AND vo.is_primary AND g.virtual_office_id IS NULL;

-- ============ PURGE LIST EXTENSION (guard logic unchanged) ============
CREATE OR REPLACE FUNCTION public.purge_demo_data()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
  DELETE FROM public.family_contacts WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('family_contacts', n);
  DELETE FROM public.families WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('families', n);
  DELETE FROM public.virtual_office WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('virtual_office', n);

  PERFORM set_config('caremuch.purge_ctx', '0', true);
  RETURN r;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.purge_demo_data_dry_run()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
      DELETE FROM public.client_care_needs WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('client_care_needs', n);
      DELETE FROM public.order_services WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('order_services', n);
      DELETE FROM public.client_orders WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('client_orders', n);
      DELETE FROM public.caregiver_skills WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_skills', n);
      DELETE FROM public.caregiver_availability WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_availability', n);
      DELETE FROM public.caregiver_certifications WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('caregiver_certifications', n);
      DELETE FROM public.time_off_requests WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('time_off_requests', n);
      DELETE FROM public.clients WHERE is_demo; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('clients', n);
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
$fn$;