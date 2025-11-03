-- Drop the existing status check constraint
ALTER TABLE public.client_orders DROP CONSTRAINT IF EXISTS client_orders_status_check;

-- Add updated status check constraint with draft and submitted
ALTER TABLE public.client_orders 
ADD CONSTRAINT client_orders_status_check 
CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'active'::text, 'completed'::text, 'cancelled'::text]));