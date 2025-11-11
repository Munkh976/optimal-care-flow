-- Fix foreign key constraints to reference agency table instead of profiles

-- Drop incorrect foreign keys
ALTER TABLE public.caregivers DROP CONSTRAINT IF EXISTS caregivers_agency_id_fkey;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_agency_id_fkey;
ALTER TABLE public.shifts DROP CONSTRAINT IF EXISTS shifts_agency_id_fkey;
ALTER TABLE public.client_orders DROP CONSTRAINT IF EXISTS client_orders_agency_id_fkey;

-- Add correct foreign keys referencing agency table
ALTER TABLE public.caregivers 
ADD CONSTRAINT caregivers_agency_id_fkey 
FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;

ALTER TABLE public.clients 
ADD CONSTRAINT clients_agency_id_fkey 
FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;

ALTER TABLE public.shifts 
ADD CONSTRAINT shifts_agency_id_fkey 
FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;

ALTER TABLE public.client_orders 
ADD CONSTRAINT client_orders_agency_id_fkey 
FOREIGN KEY (agency_id) REFERENCES public.agency(id) ON DELETE CASCADE;