-- Add status column to client_orders table
ALTER TABLE client_orders
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'active', 'completed', 'cancelled'));

-- Update existing orders to 'submitted' status
UPDATE client_orders SET status = 'submitted' WHERE status IS NULL;