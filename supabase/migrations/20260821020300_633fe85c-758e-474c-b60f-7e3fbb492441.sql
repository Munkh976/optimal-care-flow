ALTER TABLE public.profiles ALTER COLUMN agency_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id uuid;
BEGIN
  v_agency_id := NULLIF(NEW.raw_user_meta_data->>'agency_id', '')::uuid;

  -- Only accept a real, existing agency. No shared-tenant fallback.
  IF v_agency_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.agency WHERE id = v_agency_id
  ) THEN
    v_agency_id := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, agency_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_agency_id
  );
  RETURN NEW;
END;
$function$;
