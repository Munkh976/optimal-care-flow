-- Create client_orders table (collection of shifts)
CREATE TABLE IF NOT EXISTS public.client_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly', 'custom')),
  days_of_week TEXT, -- e.g., 'Mon,Wed,Fri'
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create order_shifts junction table (link shifts to orders)
CREATE TABLE IF NOT EXISTS public.order_shifts (
  order_id UUID NOT NULL REFERENCES public.client_orders(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY(order_id, shift_id)
);

-- Enable RLS on client_orders
ALTER TABLE public.client_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for client_orders
CREATE POLICY "Agency users can manage their client orders"
ON public.client_orders
FOR ALL
USING (auth.uid() = agency_id);

CREATE POLICY "Require authentication for client order access"
ON public.client_orders
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Enable RLS on order_shifts
ALTER TABLE public.order_shifts ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_shifts
CREATE POLICY "Agency users can manage order shifts"
ON public.order_shifts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.client_orders
    WHERE client_orders.id = order_shifts.order_id
    AND client_orders.agency_id = auth.uid()
  )
);

CREATE POLICY "Require authentication for order shifts access"
ON public.order_shifts
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_orders_client_id ON public.client_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_agency_id ON public.client_orders(agency_id);
CREATE INDEX IF NOT EXISTS idx_client_orders_start_date ON public.client_orders(start_date);
CREATE INDEX IF NOT EXISTS idx_order_shifts_order_id ON public.order_shifts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shifts_shift_id ON public.order_shifts(shift_id);

-- Add trigger for updated_at
CREATE TRIGGER update_client_orders_updated_at
BEFORE UPDATE ON public.client_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();