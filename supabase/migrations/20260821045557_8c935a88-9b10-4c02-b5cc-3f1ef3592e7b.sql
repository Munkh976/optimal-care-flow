REVOKE EXECUTE ON FUNCTION public.check_assignment_eligibility(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assign_caregiver_to_shift(uuid,uuid,assignment_method,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.caregiver_pick_up_shift(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_assignment_columns() FROM anon, authenticated, public;