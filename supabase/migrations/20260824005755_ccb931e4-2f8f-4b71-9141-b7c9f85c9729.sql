REVOKE ALL ON public.client_time_windows FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_time_windows TO authenticated;
GRANT ALL ON public.client_time_windows TO service_role;