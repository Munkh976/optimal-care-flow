-- Users-First Architecture: Phase 1 - Add user_id and link to profiles

-- Step 1: Add user_id columns to caregivers and clients (nullable initially for data migration)
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Step 2: For existing caregivers, try to link to profiles by email
UPDATE caregivers c
SET user_id = p.id
FROM profiles p
WHERE p.email = c.email 
  AND c.user_id IS NULL;

-- Step 3: Add email column to clients if needed (for profile linking)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email text;

-- Step 4: For clients, try to link to profiles by matching name and phone
-- (This is for any clients that might already have auth accounts)
UPDATE clients cl
SET user_id = p.id
FROM profiles p
WHERE p.phone = cl.phone 
  AND p.full_name = cl.first_name || ' ' || cl.last_name
  AND cl.user_id IS NULL;

-- Step 5: Create indexes for better join performance
CREATE INDEX IF NOT EXISTS idx_caregivers_user_id ON caregivers(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Step 6: Update RLS policies for caregivers to allow profile-based access
DROP POLICY IF EXISTS "Caregivers can view their own profile" ON caregivers;
CREATE POLICY "Caregivers can view their own profile"
ON caregivers FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Caregivers can update their own profile" ON caregivers;
CREATE POLICY "Caregivers can update their own profile"
ON caregivers FOR UPDATE
USING (user_id = auth.uid());

-- Step 7: Update RLS policies for clients to allow profile-based access
DROP POLICY IF EXISTS "Clients can view their own profile" ON clients;
CREATE POLICY "Clients can view their own profile"
ON clients FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Clients can update their own profile" ON clients;
CREATE POLICY "Clients can update their own profile"
ON clients FOR UPDATE
USING (user_id = auth.uid());

-- Step 8: Add helper function to get full caregiver profile with user data
CREATE OR REPLACE FUNCTION get_caregiver_with_profile(caregiver_uuid uuid)
RETURNS TABLE (
  id uuid,
  agency_id uuid,
  user_id uuid,
  full_name text,
  email text,
  phone text,
  role caregiver_role,
  hourly_rate numeric,
  performance_rating numeric,
  is_active boolean
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.agency_id,
    c.user_id,
    COALESCE(p.full_name, c.first_name || ' ' || c.last_name) as full_name,
    COALESCE(p.email, c.email) as email,
    COALESCE(p.phone, c.phone) as phone,
    c.role,
    c.hourly_rate,
    c.performance_rating,
    c.is_active
  FROM caregivers c
  LEFT JOIN profiles p ON c.user_id = p.id
  WHERE c.id = caregiver_uuid;
$$;

-- Step 9: Add helper function to get full client profile with user data
CREATE OR REPLACE FUNCTION get_client_with_profile(client_uuid uuid)
RETURNS TABLE (
  id uuid,
  agency_id uuid,
  user_id uuid,
  full_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  medical_conditions text[],
  is_active boolean
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cl.id,
    cl.agency_id,
    cl.user_id,
    COALESCE(p.full_name, cl.first_name || ' ' || cl.last_name) as full_name,
    COALESCE(p.email, cl.email) as email,
    COALESCE(p.phone, cl.phone) as phone,
    cl.address,
    cl.city,
    cl.state,
    cl.medical_conditions,
    cl.is_active
  FROM clients cl
  LEFT JOIN profiles p ON cl.user_id = p.id
  WHERE cl.id = client_uuid;
$$;