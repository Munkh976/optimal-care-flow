-- Create care_types table
CREATE TABLE public.care_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#3b82f6',
  is_active boolean DEFAULT true,
  agency_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create care_needs table with many-to-one relationship to care_types
CREATE TABLE public.care_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  care_type_id uuid REFERENCES public.care_types(id) ON DELETE CASCADE NOT NULL,
  requires_certification boolean DEFAULT false,
  is_active boolean DEFAULT true,
  agency_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.care_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_needs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for care_types
CREATE POLICY "Agency users can manage their care types"
ON public.care_types
FOR ALL
USING (auth.uid() = agency_id);

CREATE POLICY "Require authentication for care type access"
ON public.care_types
FOR ALL
USING (auth.uid() IS NOT NULL);

-- RLS Policies for care_needs
CREATE POLICY "Agency users can manage their care needs"
ON public.care_needs
FOR ALL
USING (auth.uid() = agency_id);

CREATE POLICY "Require authentication for care need access"
ON public.care_needs
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Add indexes for better performance
CREATE INDEX idx_care_needs_care_type_id ON public.care_needs(care_type_id);
CREATE INDEX idx_care_types_agency_id ON public.care_types(agency_id);
CREATE INDEX idx_care_needs_agency_id ON public.care_needs(agency_id);

-- Create trigger for updated_at
CREATE TRIGGER update_care_types_updated_at
BEFORE UPDATE ON public.care_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_care_needs_updated_at
BEFORE UPDATE ON public.care_needs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();