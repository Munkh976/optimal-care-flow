CREATE TABLE public.pending_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES public.agency(id),
  recipient_email text NOT NULL,
  recipient_name text,
  kind text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_notifications TO authenticated;
GRANT ALL ON public.pending_notifications TO service_role;

ALTER TABLE public.pending_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pending notifications"
ON public.pending_notifications FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin') OR
  public.has_role(auth.uid(), 'agency_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'hr_staff')
);

CREATE POLICY "Staff can update pending notifications"
ON public.pending_notifications FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin') OR
  public.has_role(auth.uid(), 'agency_admin') OR
  public.has_role(auth.uid(), 'manager')
);

CREATE TRIGGER update_pending_notifications_updated_at
BEFORE UPDATE ON public.pending_notifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Managers can view caregiver registrations" ON public.caregiver_registrations;
DROP POLICY IF EXISTS "Managers can update caregiver registrations" ON public.caregiver_registrations;

CREATE POLICY "Staff can view caregiver registrations"
ON public.caregiver_registrations FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin') OR
  public.has_role(auth.uid(), 'agency_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'hr_staff')
);

CREATE POLICY "Staff can update caregiver registrations"
ON public.caregiver_registrations FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'system_admin') OR
  public.has_role(auth.uid(), 'agency_admin') OR
  public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'hr_staff')
);