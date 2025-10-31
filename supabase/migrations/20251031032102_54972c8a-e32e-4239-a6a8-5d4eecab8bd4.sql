-- Function to assign caregiver role after approval
CREATE OR REPLACE FUNCTION assign_caregiver_role(caregiver_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find user by email
  SELECT id INTO user_record FROM auth.users WHERE email = caregiver_email;
  
  IF user_record.id IS NOT NULL THEN
    -- Insert or update role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_record.id, 'caregiver'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;