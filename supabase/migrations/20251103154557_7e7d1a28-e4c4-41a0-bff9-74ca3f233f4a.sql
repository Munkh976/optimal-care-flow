-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create policy for users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'system_admin'::app_role) OR 
  has_role(auth.uid(), 'agency_admin'::app_role)
);