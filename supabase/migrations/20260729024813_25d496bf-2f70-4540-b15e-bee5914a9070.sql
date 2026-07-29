-- Ensure Data API roles can reach the tables their RLS policies already protect.
GRANT INSERT ON public.caregiver_registrations TO anon;
GRANT SELECT, INSERT ON public.caregiver_registrations TO authenticated;
GRANT ALL ON public.caregiver_registrations TO service_role;

GRANT SELECT ON public.care_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_types TO authenticated;
GRANT ALL ON public.care_types TO service_role;

GRANT SELECT ON public.care_service_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_service_categories TO authenticated;
GRANT ALL ON public.care_service_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caregiver_skills TO authenticated;
GRANT ALL ON public.caregiver_skills TO service_role;

-- Let anonymous candidates read the active public Care Services catalog during registration.
DROP POLICY IF EXISTS "Public can view active care service categories" ON public.care_service_categories;
CREATE POLICY "Public can view active care service categories"
ON public.care_service_categories
FOR SELECT
TO anon
USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active care services" ON public.care_types;
CREATE POLICY "Public can view active care services"
ON public.care_types
FOR SELECT
TO anon
USING (is_active = true);

-- Allow candidate submissions to return the created id without exposing applications to public listing.
DROP POLICY IF EXISTS "Candidates can read their newly submitted registration id" ON public.caregiver_registrations;
CREATE POLICY "Candidates can read their newly submitted registration id"
ON public.caregiver_registrations
FOR SELECT
TO anon
USING (false);

-- Capture the candidate's selected Care Services during application.
ALTER TABLE public.caregiver_registrations
ADD COLUMN IF NOT EXISTS care_type_codes text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.caregiver_registrations
DROP CONSTRAINT IF EXISTS caregiver_registrations_care_type_codes_valid;
ALTER TABLE public.caregiver_registrations
ADD CONSTRAINT caregiver_registrations_care_type_codes_valid
CHECK (array_length(care_type_codes, 1) IS NULL OR array_length(care_type_codes, 1) <= 50);

-- Normalize Care Service category relationship while keeping the existing category text for app compatibility.
ALTER TABLE public.care_types
ADD COLUMN IF NOT EXISTS category_id uuid;

INSERT INTO public.care_service_categories (name, code_prefix, sort_order, is_active)
SELECT DISTINCT ct.category, upper(left(regexp_replace(ct.category, '[^A-Za-z0-9]+', '', 'g'), 6)), 999, true
FROM public.care_types ct
WHERE ct.category IS NOT NULL
  AND btrim(ct.category) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.care_service_categories c WHERE lower(c.name) = lower(ct.category)
  );

UPDATE public.care_types ct
SET category_id = c.id
FROM public.care_service_categories c
WHERE ct.category_id IS NULL
  AND lower(c.name) = lower(ct.category);

ALTER TABLE public.care_types
DROP CONSTRAINT IF EXISTS care_types_category_id_fkey;
ALTER TABLE public.care_types
ADD CONSTRAINT care_types_category_id_fkey
FOREIGN KEY (category_id)
REFERENCES public.care_service_categories(id)
ON UPDATE CASCADE
ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.sync_care_type_category_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT name INTO NEW.category
    FROM public.care_service_categories
    WHERE id = NEW.category_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_care_type_category_name_trigger ON public.care_types;
CREATE TRIGGER sync_care_type_category_name_trigger
BEFORE INSERT OR UPDATE OF category_id ON public.care_types
FOR EACH ROW
EXECUTE FUNCTION public.sync_care_type_category_name();

CREATE OR REPLACE FUNCTION public.sync_care_types_on_category_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.care_types
  SET category = NEW.name
  WHERE category_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_care_types_on_category_rename_trigger ON public.care_service_categories;
CREATE TRIGGER sync_care_types_on_category_rename_trigger
AFTER UPDATE OF name ON public.care_service_categories
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.sync_care_types_on_category_rename();