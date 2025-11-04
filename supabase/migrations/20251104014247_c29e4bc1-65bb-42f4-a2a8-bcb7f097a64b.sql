-- Add sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- Add function to generate sequential order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  next_num := nextval('order_number_seq');
  RETURN 'ORD-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update existing orders with sequential numbers
DO $$
DECLARE
  order_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR order_record IN 
    SELECT id FROM client_orders ORDER BY created_at
  LOOP
    UPDATE client_orders 
    SET order_number = 'ORD-' || LPAD(counter::TEXT, 4, '0')
    WHERE id = order_record.id;
    counter := counter + 1;
  END LOOP;
  
  -- Set sequence to continue from current max
  PERFORM setval('order_number_seq', counter);
END $$;

-- Add comment explaining status usage
COMMENT ON COLUMN client_orders.status IS 
'Use for workflow tracking (draft/submitted/active/completed). Order is active when CURRENT_DATE BETWEEN start_date AND end_date.';