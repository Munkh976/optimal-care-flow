CREATE TABLE public.order_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.client_orders(id) ON DELETE CASCADE,
  care_type_code text NOT NULL REFERENCES public.care_types(code) ON UPDATE CASCADE,
  days_of_week integer[] NOT NULL DEFAULT '{}',
  start_time time NOT NULL,
  end_time time NOT NULL,
  frequency text NOT NULL DEFAULT 'weekly',
  week_of_month integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_services TO authenticated;
GRANT ALL ON public.order_services TO service_role;

ALTER TABLE public.order_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users can manage order services"
ON public.order_services FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.client_orders o
  JOIN public.profiles p ON p.agency_id = o.agency_id
  WHERE o.id = order_services.order_id AND p.id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.client_orders o
  JOIN public.profiles p ON p.agency_id = o.agency_id
  WHERE o.id = order_services.order_id AND p.id = auth.uid()
));

CREATE TRIGGER update_order_services_updated_at
BEFORE UPDATE ON public.order_services
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_order_services_order_id ON public.order_services(order_id);

ALTER TABLE public.client_orders ADD COLUMN IF NOT EXISTS duration_months integer;

ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS order_service_id uuid REFERENCES public.order_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_order_service_id ON public.shifts(order_service_id);

-- Backfill: one service line per (order, care service, start/end time) from existing shifts
WITH grouped AS (
  SELECT s.order_id,
         s.care_type_code,
         s.start_time,
         s.end_time,
         array_agg(DISTINCT EXTRACT(DOW FROM s.shift_date)::int) AS dows
  FROM public.shifts s
  WHERE s.order_id IS NOT NULL
  GROUP BY s.order_id, s.care_type_code, s.start_time, s.end_time
),
inserted AS (
  INSERT INTO public.order_services (order_id, care_type_code, days_of_week, start_time, end_time, frequency)
  SELECT g.order_id, g.care_type_code, g.dows, g.start_time, g.end_time,
         COALESCE(o.frequency, 'weekly')
  FROM grouped g
  JOIN public.client_orders o ON o.id = g.order_id
  RETURNING id, order_id, care_type_code, start_time, end_time
)
UPDATE public.shifts s
SET order_service_id = i.id
FROM inserted i
WHERE s.order_id = i.order_id
  AND s.care_type_code = i.care_type_code
  AND s.start_time = i.start_time
  AND s.end_time = i.end_time;