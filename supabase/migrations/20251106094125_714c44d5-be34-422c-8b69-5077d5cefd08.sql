-- Add price column to care_types table
ALTER TABLE care_types ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 35.00;

-- Drop the old frequency check constraint
ALTER TABLE client_orders DROP CONSTRAINT IF EXISTS client_orders_frequency_check;

-- Add new frequency check constraint with all valid options
ALTER TABLE client_orders ADD CONSTRAINT client_orders_frequency_check 
  CHECK (frequency IN ('once', 'daily', 'weekly', 'biweekly', 'monthly', 'custom'));

-- Update existing care_types with sample prices based on category
UPDATE care_types SET price = CASE
  WHEN category = 'Activities of Daily Living (ADL)' THEN 35.00
  WHEN category = 'Health Monitoring & Care' THEN 45.00
  WHEN category = 'Instrumental Activities of Daily Living (IADL)' THEN 32.00
  WHEN category = 'Cognitive & Emotional Support' THEN 40.00
  WHEN category = 'Safety & Transportation' THEN 38.00
  WHEN category = 'Specialized Care' THEN 50.00
  ELSE 35.00
END
WHERE price IS NULL;