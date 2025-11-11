-- Add foreign key constraints linking to agency table (with checks for existing constraints)
DO $$
BEGIN
  -- Add profiles foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_agency_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_agency_id_fkey 
      FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;
  END IF;

  -- Add clients foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'clients_agency_id_fkey' AND table_name = 'clients'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_agency_id_fkey 
      FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;
  END IF;

  -- Add caregivers foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'caregivers_agency_id_fkey' AND table_name = 'caregivers'
  ) THEN
    ALTER TABLE public.caregivers
      ADD CONSTRAINT caregivers_agency_id_fkey 
      FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;
  END IF;

  -- Add user_roles foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_roles_agency_id_fkey' AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_agency_id_fkey 
      FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update the handle_new_user trigger function to set agency_id from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, agency_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(
      (NEW.raw_user_meta_data->>'agency_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid  -- Default to system agency
    )
  );
  RETURN NEW;
END;
$$;