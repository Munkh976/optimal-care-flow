-- ENUM
DO $$ BEGIN
  CREATE TYPE public.care_request_status AS ENUM ('new','reviewing','matched','scheduled','fulfilled','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- care_requests
CREATE TABLE public.care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  virtual_office_id uuid NULL REFERENCES public.virtual_office(id) ON DELETE SET NULL,
  family_id uuid NULL REFERENCES public.families(id) ON DELETE SET NULL,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  request_number text NULL,
  status public.care_request_status NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'staff',
  priority text NOT NULL DEFAULT 'normal',
  care_type_codes text[] NOT NULL DEFAULT '{}',
  requested_start_date date NULL,
  requested_end_date date NULL,
  requested_start_time time without time zone NULL,
  requested_end_time time without time zone NULL,
  recurrence_hint text NULL,
  estimated_hours_per_week numeric NULL,
  location_address text NULL,
  location_city text NULL,
  location_state text NULL,
  location_zip_code text NULL,
  requested_caregiver_id uuid NULL REFERENCES public.caregivers(id) ON DELETE SET NULL,
  notes text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_requests_owner_chk CHECK (client_id IS NOT NULL OR family_id IS NOT NULL),
  CONSTRAINT care_requests_source_chk CHECK (source IN ('staff','family_portal','assistant_intake','phone','other')),
  CONSTRAINT care_requests_priority_chk CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT care_requests_date_chk CHECK (requested_end_date IS NULL OR requested_start_date IS NULL OR requested_end_date >= requested_start_date)
);

CREATE INDEX idx_care_requests_agency ON public.care_requests(agency_id);
CREATE INDEX idx_care_requests_client ON public.care_requests(client_id);
CREATE INDEX idx_care_requests_family ON public.care_requests(family_id);
CREATE INDEX idx_care_requests_status ON public.care_requests(status);

CREATE TRIGGER trg_care_requests_updated_at BEFORE UPDATE ON public.care_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_requests TO authenticated;
GRANT ALL ON public.care_requests TO service_role;
ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_requests_select" ON public.care_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR agency_id = public.current_agency_id()
  OR client_id IN (SELECT public.my_client_ids())
  OR family_id IN (SELECT c.family_id FROM public.clients c WHERE c.id IN (SELECT public.my_client_ids()) AND c.family_id IS NOT NULL)
);

CREATE POLICY "care_requests_insert" ON public.care_requests FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
);

CREATE POLICY "care_requests_update" ON public.care_requests FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
)
WITH CHECK (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
);

CREATE POLICY "care_requests_delete" ON public.care_requests FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
);

-- caregiver_preferences
CREATE TABLE public.caregiver_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL UNIQUE REFERENCES public.caregivers(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES public.agency(id) ON DELETE CASCADE,
  preferred_zip_codes text[] NOT NULL DEFAULT '{}',
  preferred_cities text[] NOT NULL DEFAULT '{}',
  max_travel_miles numeric NULL,
  max_travel_minutes integer NULL,
  preferred_days integer[] NOT NULL DEFAULT '{}',
  preferred_time_of_day text[] NOT NULL DEFAULT '{}',
  preferred_start_time time without time zone NULL,
  preferred_end_time time without time zone NULL,
  desired_weekly_hours numeric NULL,
  min_weekly_hours numeric NULL,
  max_weekly_hours numeric NULL,
  desired_weekly_earnings numeric NULL,
  desired_hourly_rate numeric NULL,
  flexibility text NOT NULL DEFAULT 'flexible',
  willing_to_travel_outside_area boolean NOT NULL DEFAULT false,
  open_to_short_notice boolean NOT NULL DEFAULT false,
  preferred_care_type_codes text[] NOT NULL DEFAULT '{}',
  notes text NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT caregiver_preferences_flexibility_chk CHECK (flexibility IN ('strict','moderate','flexible'))
);

CREATE INDEX idx_caregiver_preferences_agency ON public.caregiver_preferences(agency_id);

CREATE TRIGGER trg_caregiver_preferences_updated_at BEFORE UPDATE ON public.caregiver_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_preferences TO authenticated;
GRANT ALL ON public.caregiver_preferences TO service_role;
ALTER TABLE public.caregiver_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caregiver_preferences_select" ON public.caregiver_preferences FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
);

CREATE POLICY "caregiver_preferences_insert" ON public.caregiver_preferences FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
);

CREATE POLICY "caregiver_preferences_update" ON public.caregiver_preferences FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
)
WITH CHECK (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR caregiver_id IN (SELECT public.my_caregiver_ids())
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
);

CREATE POLICY "caregiver_preferences_delete" ON public.caregiver_preferences FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin'::app_role)
  OR (public.is_agency_staff(auth.uid()) AND agency_id = public.current_agency_id())
);

-- inert link column on shifts
ALTER TABLE public.shifts ADD COLUMN care_request_id uuid NULL REFERENCES public.care_requests(id) ON DELETE SET NULL;
