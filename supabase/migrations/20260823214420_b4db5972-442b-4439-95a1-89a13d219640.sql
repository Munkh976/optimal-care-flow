DROP POLICY IF EXISTS "Anyone can submit a pending caregiver registration" ON public.caregiver_registrations;
CREATE POLICY "Anyone can submit a pending caregiver registration"
ON public.caregiver_registrations FOR INSERT TO anon, authenticated
WITH CHECK (
  COALESCE(status, 'pending') = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND rejection_reason IS NULL
  AND (
    agency_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.virtual_office vo
      WHERE vo.agency_id = caregiver_registrations.agency_id
        AND vo.slug IS NOT NULL
        AND vo.is_active
    )
  )
);

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
  END LOOP;
END $$;

GRANT SELECT ON public.conversation_flows TO anon;
GRANT SELECT ON public.flow_nodes TO anon;
GRANT SELECT ON public.flow_options TO anon;
GRANT SELECT ON public.care_types TO anon;
GRANT SELECT ON public.care_service_categories TO anon;
GRANT SELECT ON public.certifications TO anon;
GRANT INSERT ON public.conversation_sessions TO anon;
GRANT INSERT ON public.conversation_answers TO anon;
GRANT INSERT ON public.caregiver_registrations TO anon;