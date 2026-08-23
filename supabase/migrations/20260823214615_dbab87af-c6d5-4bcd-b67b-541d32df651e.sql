CREATE OR REPLACE FUNCTION public.is_published_public_agency(_agency_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.virtual_office vo
    WHERE vo.agency_id = _agency_id AND vo.slug IS NOT NULL AND vo.is_active
  )
$$;
REVOKE ALL ON FUNCTION public.is_published_public_agency(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_published_public_agency(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can submit a pending caregiver registration" ON public.caregiver_registrations;
CREATE POLICY "Anyone can submit a pending caregiver registration"
ON public.caregiver_registrations FOR INSERT TO anon, authenticated
WITH CHECK (
  COALESCE(status, 'pending') = 'pending'
  AND reviewed_by IS NULL
  AND reviewed_at IS NULL
  AND rejection_reason IS NULL
  AND (agency_id IS NULL OR public.is_published_public_agency(agency_id))
);