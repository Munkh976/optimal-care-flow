-- Add 'client' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'client';

-- Remove the role field from profiles table (roles should ONLY be in user_roles for security)
ALTER TABLE profiles DROP COLUMN IF EXISTS role;