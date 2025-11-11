create table public.shift_assignments (
  id uuid not null default gen_random_uuid (),
  shift_id uuid not null,
  caregiver_id uuid not null,
  status public.assignment_status not null default 'scheduled'::assignment_status,
  is_locked boolean null default true,
  clock_in_time timestamp with time zone null,
  clock_in_location text null,
  clock_out_time timestamp with time zone null,
  clock_out_location text null,
  actual_hours_worked numeric null,
  mileage numeric null,
  notes text null,
  assigned_at timestamp with time zone null default now(),
  assignment_method public.assignment_method not null default 'manual'::assignment_method,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint shift_assignments_pkey primary key (id),
  constraint shift_assignments_caregiver_id_fkey foreign KEY (caregiver_id) references caregivers (id) on delete CASCADE,
  constraint shift_assignments_shift_id_fkey foreign KEY (shift_id) references shifts (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger update_shift_assignments_updated_at BEFORE
update on shift_assignments for EACH row
execute FUNCTION update_updated_at_column ();