create table public.shifts (
  id uuid not null default gen_random_uuid (),
  agency_id uuid not null,
  client_id uuid not null,
  caregiver_id uuid null,
  shift_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  duration_hours numeric(5, 2) not null,
  status public.shift_status null default 'open'::shift_status,
  required_skills text[] null default '{}'::text[],
  special_instructions text null,
  ai_match_score integer null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  pay_rate numeric null,
  is_recurring boolean null default false,
  recurrence_pattern text null,
  special_notes text null,
  order_title text not null default 'Care Service Order'::text,
  care_type_code text not null,
  order_id uuid null,
  constraint shifts_pkey primary key (id),
  constraint shifts_agency_id_fkey foreign KEY (agency_id) references profiles (id) on delete CASCADE,
  constraint shifts_care_type_code_fkey foreign KEY (care_type_code) references care_types (code),
  constraint shifts_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint shifts_order_id_fkey foreign KEY (order_id) references client_orders (id) on delete CASCADE,
  constraint shifts_caregiver_id_fkey foreign KEY (caregiver_id) references caregivers (id) on delete set null,
  constraint check_duration_hours check (
    (
      duration_hours = any (
        array[
          (2)::numeric,
          (3)::numeric,
          (4)::numeric,
          (8)::numeric
        ]
      )
    )
  )
) TABLESPACE pg_default;

create trigger update_shifts_updated_at BEFORE
update on shifts for EACH row
execute FUNCTION update_updated_at_column ();