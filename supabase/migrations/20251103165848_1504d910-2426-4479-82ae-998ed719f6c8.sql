-- Drop existing tables and recreate with proper schema
DROP TABLE IF EXISTS public.client_care_needs CASCADE;
DROP TABLE IF EXISTS public.care_needs CASCADE;
DROP TABLE IF EXISTS public.care_types CASCADE;

-- Create care_types table with category
CREATE TABLE public.care_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    category text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create care_needs table with related care type codes
CREATE TABLE public.care_needs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    category text NOT NULL,
    name text NOT NULL,
    description text,
    related_care_type_codes text[] DEFAULT '{}',
    related_care_type_names text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create client_care_needs junction table
CREATE TABLE public.client_care_needs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    care_need_code text REFERENCES public.care_needs(code) NOT NULL,
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

-- RLS Policies for care_types
CREATE POLICY "Anyone authenticated can view care types"
ON public.care_types FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage care types"
ON public.care_types FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'system_admin') OR has_role(auth.uid(), 'agency_admin'));

-- RLS Policies for care_needs
CREATE POLICY "Anyone authenticated can view care needs"
ON public.care_needs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage care needs"
ON public.care_needs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'system_admin') OR has_role(auth.uid(), 'agency_admin'));

-- RLS Policies for client_care_needs
CREATE POLICY "Agency users can manage client care needs"
ON public.client_care_needs FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clients
    WHERE clients.id = client_care_needs.client_id
    AND clients.agency_id = auth.uid()
  )
);

-- Insert care_types data (35 entries)
INSERT INTO public.care_types (code, category, name, description) VALUES
('CT001', 'ADL', 'Bathing Assistance', 'Help with washing, grooming, or showering'),
('CT002', 'ADL', 'Dressing Assistance', 'Help choosing and putting on clothes'),
('CT003', 'ADL', 'Eating Support', 'Feeding assistance or preparing utensils'),
('CT004', 'ADL', 'Toileting Support', 'Help using the toilet, hygiene, or incontinence care'),
('CT005', 'ADL', 'Mobility Assistance', 'Helping move between bed, chair, toilet, etc.'),
('CT006', 'ADL', 'Transferring / Positioning', 'Support with getting in/out of bed or adjusting position'),
('CT007', 'IADL', 'Meal Preparation', 'Planning, cooking, and serving meals'),
('CT008', 'IADL', 'Housekeeping', 'Cleaning, laundry, home organization'),
('CT009', 'IADL', 'Grocery Shopping', 'Shopping for groceries or household supplies'),
('CT010', 'IADL', 'Managing Finances', 'Paying bills, budgeting, or handling expenses'),
('CT011', 'IADL', 'Medication Management', 'Organizing, reminding, or administering medication'),
('CT012', 'IADL', 'Communication Assistance', 'Help making phone calls, sending messages, or using devices'),
('CT013', 'Mobility', 'Walking Support', 'Physical assistance with walking or balance'),
('CT014', 'Mobility', 'Wheelchair / Ambulation Support', 'Handling mobility aids and transfers'),
('CT015', 'Mobility', 'Fall Prevention', 'Monitoring and home safety for mobility risks'),
('CT016', 'Cognitive', 'Memory Support', 'Reminders, cognitive stimulation, orientation help'),
('CT017', 'Cognitive', 'Decision-Making Support', 'Guidance for daily decisions and problem-solving'),
('CT018', 'Emotional', 'Companionship', 'Conversation, emotional support, social visits'),
('CT019', 'Emotional', 'Behavioral Support', 'Managing anxiety, agitation, or depression'),
('CT020', 'Social', 'Recreation & Activities', 'Engaging clients in hobbies or group activities'),
('CT021', 'Health', 'Vital Sign Monitoring', 'Checking temperature, pulse, blood pressure, etc.'),
('CT022', 'Health', 'Wound Care', 'Cleaning and dressing minor wounds or sores'),
('CT023', 'Health', 'Post-Hospital Recovery', 'Observation and light rehabilitation after discharge'),
('CT024', 'Health', 'Chronic Condition Support', 'Helping manage diabetes, heart disease, etc.'),
('CT025', 'Household', 'Home Maintenance', 'Light repairs, decluttering, plant care'),
('CT026', 'Household', 'Laundry', 'Washing, drying, and folding clothes'),
('CT027', 'Household', 'Home Safety Check', 'Identifying tripping or fire hazards'),
('CT028', 'Transport', 'Transportation', 'Driving or escorting to appointments or errands'),
('CT029', 'Transport', 'Appointment Escort', 'Accompanying clients for medical or social visits'),
('CT030', 'Specialized', 'Dementia / Alzheimer''s Care', 'Specialized supervision and activity engagement'),
('CT031', 'Specialized', 'Parkinson''s / Mobility Disorder Care', 'Assistance with tremors, stiffness, movement'),
('CT032', 'Specialized', 'Palliative / End-of-Life Care', 'Comfort care, pain management, emotional support'),
('CT033', 'Specialized', 'Respite Care', 'Temporary care to relieve family caregivers'),
('CT034', 'Specialized', 'Overnight Supervision', 'Nighttime monitoring and safety'),
('CT035', 'Specialized', 'Hospice Support', 'Coordination with hospice staff for comfort and dignity');

-- Insert care_needs data (32 entries)
INSERT INTO public.care_needs (code, category, name, description, related_care_type_codes, related_care_type_names) VALUES
('CN001', 'ADL', 'Needs help bathing', 'Difficulty washing or grooming independently', ARRAY['CT001'], 'Bathing Assistance'),
('CN002', 'ADL', 'Needs help dressing', 'Difficulty choosing or putting on clothes', ARRAY['CT002'], 'Dressing Assistance'),
('CN003', 'ADL', 'Needs help eating', 'Needs assistance cutting or feeding', ARRAY['CT003'], 'Eating Support'),
('CN004', 'ADL', 'Needs help toileting', 'Assistance with bathroom use or hygiene', ARRAY['CT004'], 'Toileting Support'),
('CN005', 'ADL', 'Needs mobility aid', 'Difficulty walking or transferring', ARRAY['CT005', 'CT013', 'CT014'], 'Mobility Assistance, Walking Support, Wheelchair Support'),
('CN006', 'ADL', 'Needs transfer help', 'Cannot get in/out of bed alone', ARRAY['CT006'], 'Transferring / Positioning'),
('CN007', 'IADL', 'Needs meal preparation', 'Cannot cook or plan meals independently', ARRAY['CT007'], 'Meal Preparation'),
('CN008', 'IADL', 'Needs housekeeping', 'Struggles maintaining cleanliness', ARRAY['CT008'], 'Housekeeping'),
('CN009', 'IADL', 'Needs grocery help', 'Cannot shop or carry groceries', ARRAY['CT009'], 'Grocery Shopping'),
('CN010', 'IADL', 'Needs help managing money', 'Trouble paying bills or budgeting', ARRAY['CT010'], 'Managing Finances'),
('CN011', 'IADL', 'Needs medication management', 'Misses doses or forgets timing', ARRAY['CT011'], 'Medication Management'),
('CN012', 'IADL', 'Needs communication help', 'Has difficulty using phone or tech', ARRAY['CT012'], 'Communication Assistance'),
('CN013', 'Mobility', 'Needs walking assistance', 'Requires physical aid or supervision', ARRAY['CT013'], 'Walking Support'),
('CN014', 'Mobility', 'High fall risk', 'Prone to falling or imbalance', ARRAY['CT015', 'CT027'], 'Fall Prevention, Home Safety Check'),
('CN015', 'Cognitive', 'Memory issues', 'Forgetfulness, dementia symptoms', ARRAY['CT016', 'CT030'], 'Memory Support, Dementia Care'),
('CN016', 'Cognitive', 'Disorientation', 'Gets lost or confused easily', ARRAY['CT016', 'CT017', 'CT030'], 'Memory Support, Decision-Making Support, Dementia Care'),
('CN017', 'Emotional', 'Feels lonely or anxious', 'Needs companionship or reassurance', ARRAY['CT018', 'CT020'], 'Companionship, Recreation & Activities'),
('CN018', 'Emotional', 'Behavioral changes', 'Mood swings, anxiety, or agitation', ARRAY['CT019'], 'Behavioral Support'),
('CN019', 'Health', 'Needs medication reminders', 'Forgets or skips medications', ARRAY['CT011'], 'Medication Management'),
('CN020', 'Health', 'Needs vital monitoring', 'Requires observation of health metrics', ARRAY['CT021', 'CT023'], 'Vital Sign Monitoring, Post-Hospital Recovery'),
('CN021', 'Health', 'Needs wound care', 'Has sores, injuries, or skin conditions', ARRAY['CT022'], 'Wound Care'),
('CN022', 'Health', 'Post-surgery recovery', 'Needs support during healing', ARRAY['CT023'], 'Post-Hospital Recovery'),
('CN023', 'Health', 'Chronic condition management', 'Ongoing conditions like diabetes, COPD', ARRAY['CT024'], 'Chronic Condition Support'),
('CN024', 'Household', 'Needs home safety check', 'Unsafe environment, fall hazards', ARRAY['CT027', 'CT015'], 'Home Safety Check, Fall Prevention'),
('CN025', 'Household', 'Needs laundry / chores', 'Cannot manage cleaning or laundry', ARRAY['CT026', 'CT008'], 'Laundry, Housekeeping'),
('CN026', 'Transport', 'Needs ride to appointments', 'No car, cannot drive safely', ARRAY['CT028'], 'Transportation'),
('CN027', 'Transport', 'Needs escort for errands', 'Needs company to navigate places', ARRAY['CT029', 'CT028'], 'Appointment Escort, Transportation'),
('CN028', 'Specialized', 'Needs dementia care', 'Diagnosed cognitive decline', ARRAY['CT030'], 'Dementia / Alzheimer''s Care'),
('CN029', 'Specialized', 'Needs palliative care', 'Serious illness, comfort-focused', ARRAY['CT032', 'CT035'], 'Palliative Care, Hospice Support'),
('CN030', 'Specialized', 'Needs respite for family', 'Family caregiver needs relief', ARRAY['CT033'], 'Respite Care'),
('CN031', 'Specialized', 'Needs overnight supervision', 'Wanders or unsafe at night', ARRAY['CT034'], 'Overnight Supervision'),
('CN032', 'Specialized', 'Needs Parkinson''s/mobility support', 'Tremors, stiffness, or advanced mobility disorder', ARRAY['CT031'], 'Parkinson''s / Mobility Disorder Care');