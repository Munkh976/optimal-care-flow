-- Fix function security: set search_path (use CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('order_number_seq');
  RETURN 'ORD-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;