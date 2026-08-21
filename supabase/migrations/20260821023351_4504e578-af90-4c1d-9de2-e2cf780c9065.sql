CREATE OR REPLACE FUNCTION public.protect_completed_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'completed'::assignment_status THEN
    RAISE EXCEPTION 'Completed shift assignments are historical records and cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_completed_assignment() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_protect_completed_assignment ON public.shift_assignments;
CREATE TRIGGER trg_protect_completed_assignment
BEFORE DELETE ON public.shift_assignments
FOR EACH ROW EXECUTE FUNCTION public.protect_completed_assignment();