-- Delete the incorrectly created munkh user from direct auth.users insert
DELETE FROM public.user_roles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'munkh.mn@gmail.com'
);
DELETE FROM public.profiles WHERE email = 'munkh.mn@gmail.com';
DELETE FROM auth.users WHERE email = 'munkh.mn@gmail.com';