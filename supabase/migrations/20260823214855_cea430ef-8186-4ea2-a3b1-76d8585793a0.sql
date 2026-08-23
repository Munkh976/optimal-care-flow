ALTER TABLE public.care_requests DROP CONSTRAINT care_requests_source_chk;
ALTER TABLE public.care_requests ADD CONSTRAINT care_requests_source_chk
CHECK (source = ANY (ARRAY['staff','family_portal','assistant_intake','public_site','phone','other']));