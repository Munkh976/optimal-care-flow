-- Fix critical security issues: Add authentication requirements to prevent public data exposure

-- 1. Require authentication for caregivers table access
CREATE POLICY "Require authentication for caregiver access"
  ON public.caregivers
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 2. Require authentication for clients table access (HIPAA/PHI protection)
CREATE POLICY "Require authentication for client access"
  ON public.clients
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 3. Require authentication for shift_assignments table access (location tracking protection)
CREATE POLICY "Require authentication for shift assignment access"
  ON public.shift_assignments
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 4. Require authentication for shifts table access
CREATE POLICY "Require authentication for shift access"
  ON public.shifts
  FOR ALL
  USING (auth.uid() IS NOT NULL);