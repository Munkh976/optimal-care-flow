-- Consolidate to use care_types for both client needs and caregiver skills

-- Drop the care_needs table and migrate client_care_needs to use care_types
ALTER TABLE public.client_care_needs 
DROP CONSTRAINT IF EXISTS client_care_needs_care_need_code_fkey;

-- Rename column from care_need_code to care_type_code for consistency
ALTER TABLE public.client_care_needs 
RENAME COLUMN care_need_code TO care_type_code;

-- Add foreign key to care_types
ALTER TABLE public.client_care_needs
ADD CONSTRAINT client_care_needs_care_type_code_fkey
FOREIGN KEY (care_type_code) REFERENCES public.care_types(code) ON DELETE CASCADE;

-- Drop the care_needs table since we're not using it
DROP TABLE IF EXISTS public.care_needs CASCADE;

-- Add helpful comment
COMMENT ON TABLE public.client_care_needs IS 'Client care requirements using standardized care_types codes';
COMMENT ON COLUMN public.client_care_needs.care_type_code IS 'References care_types.code for standardized care services';