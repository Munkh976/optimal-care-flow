REVOKE EXECUTE ON FUNCTION public.derived_shift_caregiver(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.sync_shift_caregiver_from_assignment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_derived_shift_caregiver() FROM anon, authenticated, public;