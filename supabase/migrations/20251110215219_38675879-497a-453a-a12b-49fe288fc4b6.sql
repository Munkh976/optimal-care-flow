-- First, ensure the system agency exists
INSERT INTO public.agency (
  id,
  agency_name,
  email,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'System Administration',
  'admin@system.internal',
  true,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Drop and recreate the user_roles foreign key constraint to ensure it points to agency table
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_agency_id_fkey;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_agency_id_fkey 
  FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;

-- Now fix existing user_roles records to have correct agency_id from profiles
UPDATE public.user_roles ur
SET agency_id = p.agency_id
FROM public.profiles p
WHERE ur.user_id = p.id
  AND (ur.agency_id IS NULL OR ur.agency_id != p.agency_id);

-- Verify the fix
DO $$
DECLARE
  mismatched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatched_count
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON ur.user_id = p.id
  WHERE ur.agency_id != p.agency_id OR ur.agency_id IS NULL;
  
  IF mismatched_count > 0 THEN
    RAISE WARNING 'Still have % user_roles with mismatched agency_id', mismatched_count;
  ELSE
    RAISE NOTICE 'All user_roles records now have correct agency_id values';
  END IF;
END $$;