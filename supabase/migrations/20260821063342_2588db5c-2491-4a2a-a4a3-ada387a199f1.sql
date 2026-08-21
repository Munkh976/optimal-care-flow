ALTER TABLE public.client_care_needs ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.shift_ratings ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.shift_trades ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;