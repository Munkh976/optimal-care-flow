ALTER TABLE public.client_orders
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE INDEX IF NOT EXISTS client_orders_archived_at_idx ON public.client_orders (archived_at);