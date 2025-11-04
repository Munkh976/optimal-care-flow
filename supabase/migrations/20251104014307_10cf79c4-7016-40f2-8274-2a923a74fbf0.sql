-- Fix function search path security warning
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT 
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