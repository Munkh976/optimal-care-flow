-- Drop existing tables and recreate with new schema
DROP TABLE IF EXISTS public.care_needs CASCADE;
DROP TABLE IF EXISTS public.care_types CASCADE;

-- Create care_types table with NHATS schema
CREATE TABLE public.care_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    description text,
    typical_caregiver_role text,
    care_level text CHECK(care_level IN ('companionship', 'personal_care', 'skilled_nursing', 'hospice')),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create care_needs table with NHATS schema
CREATE TABLE public.care_needs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    name text NOT NULL,
    category text CHECK(category IN ('ADL', 'IADL', 'Mobility', 'Cognitive', 'Health', 'Nutrition', 'Emotional')),
    description text,
    nhats_reference text,
    care_type_code text REFERENCES public.care_types(code) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create client_care_needs junction table for many-to-many relationship
CREATE TABLE public.client_care_needs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    care_need_code text REFERENCES public.care_needs(code) ON DELETE CASCADE NOT NULL,
    priority integer DEFAULT 1,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(client_id, care_need_code)
);

-- Enable RLS
ALTER TABLE public.care_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_care_needs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for care_types (read-only for all authenticated users)
CREATE POLICY "Anyone authenticated can view care types"
    ON public.care_types FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- RLS Policies for care_needs (read-only for all authenticated users)
CREATE POLICY "Anyone authenticated can view care needs"
    ON public.care_needs FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- RLS Policies for client_care_needs
CREATE POLICY "Agency users can manage client care needs"
    ON public.client_care_needs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.clients
            WHERE clients.id = client_care_needs.client_id
            AND clients.agency_id = auth.uid()
        )
    );

-- Insert care_types sample data
INSERT INTO public.care_types (code, name, description, typical_caregiver_role, care_level) VALUES
('CT001', 'Companionship Care', 'Social interaction, emotional support, and engagement in activities.', 'Companion, HHA', 'companionship'),
('CT002', 'Personal Care', 'Assistance with bathing, dressing, grooming, toileting, and feeding.', 'CNA, HHA', 'personal_care'),
('CT003', 'Mobility Assistance', 'Helping with transfers, walking, and preventing falls.', 'CNA, HHA', 'personal_care'),
('CT004', 'Medication Support', 'Medication reminders or administration by trained staff.', 'CNA, LPN', 'skilled_nursing'),
('CT005', 'Meal Preparation', 'Cooking and feeding assistance per dietary needs.', 'HHA, Companion', 'personal_care'),
('CT006', 'Housekeeping', 'Light cleaning, laundry, and household organization.', 'Companion, HHA', 'companionship'),
('CT007', 'Transportation', 'Escorting to appointments, errands, or community activities.', 'Companion', 'companionship'),
('CT008', 'Respite Care', 'Temporary relief for family caregivers.', 'CNA, HHA', 'personal_care'),
('CT009', 'Skilled Nursing', 'Professional care including wound care, vitals, injections.', 'RN, LPN', 'skilled_nursing'),
('CT010', 'Memory Care', 'Specialized dementia and Alzheimer''s support.', 'CNA, Dementia-trained', 'personal_care'),
('CT011', 'Hospice / Palliative', 'Comfort and emotional support for end-of-life care.', 'RN, CNA', 'hospice'),
('CT012', 'Night / Overnight Care', 'Nighttime assistance and monitoring.', 'CNA, HHA', 'personal_care'),
('CT013', 'Live-In Care', '24-hour continuous care and supervision.', 'CNA, HHA', 'personal_care'),
('CT014', 'Post-Surgery Recovery', 'Assistance with ADLs, wound care, and rehabilitation post-discharge.', 'CNA, LPN', 'skilled_nursing');

-- Insert care_needs sample data
INSERT INTO public.care_needs (code, name, category, description, nhats_reference, care_type_code) VALUES
('ADL_BATH', 'Bathing Assistance', 'ADL', 'Help bathing or showering safely', 'adl_bath', 'CT002'),
('ADL_DRESS', 'Dressing Assistance', 'ADL', 'Assistance with choosing and putting on clothes', 'adl_dress', 'CT002'),
('ADL_EAT', 'Eating Assistance', 'ADL', 'Help with eating or feeding', 'adl_eat', 'CT002'),
('ADL_TOILET', 'Toileting Assistance', 'ADL', 'Assistance with toilet use and hygiene', 'adl_toilet', 'CT002'),
('IADL_MEALS', 'Meal Preparation', 'IADL', 'Cooking or meal setup', 'iadl_meals', 'CT005'),
('IADL_SHOP', 'Shopping & Errands', 'IADL', 'Grocery or household shopping', 'iadl_shop', 'CT007'),
('IADL_HOUSE', 'Housekeeping', 'IADL', 'Cleaning and laundry assistance', 'iadl_house', 'CT006'),
('IADL_TRANSPORT', 'Transportation', 'IADL', 'Escorting to appointments or errands', 'iadl_transport', 'CT007'),
('MOB_WALK', 'Walking Assistance', 'Mobility', 'Help with walking and balance', 'mobility_walk', 'CT003'),
('MOB_TRANSFER', 'Transfer Assistance', 'Mobility', 'Help moving between bed, chair, etc.', 'mobility_transfer', 'CT003'),
('COG_MEMORY', 'Memory Care', 'Cognitive', 'Support for memory loss, dementia', 'cog_memory', 'CT010'),
('EMO_COMP', 'Companionship', 'Emotional', 'Conversation, reading, games', 'social_comp', 'CT001'),
('HLTH_WOUND', 'Wound Care', 'Health', 'Dressing changes, infection monitoring', 'health_wound', 'CT009'),
('HLTH_MED', 'Medication Support', 'Health', 'Medication administration/reminders', 'iadl_meds', 'CT004'),
('NUTR_DIET', 'Dietary Management', 'Nutrition', 'Diabetic or low-sodium meal plan', 'diet_restrict', 'CT005'),
('HLTH_HOSPICE', 'Hospice Support', 'Health', 'End-of-life comfort and monitoring', 'hospice_support', 'CT011'),
('HLTH_POSTSURG', 'Post-Surgery Care', 'Health', 'Assistance during surgical recovery', 'health_postop', 'CT014');