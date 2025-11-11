create table public.client_orders (
  id uuid not null default gen_random_uuid (),
  client_id uuid not null,
  agency_id uuid not null,
  order_number text not null,
  start_date date not null,
  end_date date not null,
  frequency text not null default 'once'::text,
  days_of_week text null,
  status text null default 'active'::text,
  notes text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint client_orders_pkey primary key (id),
  constraint client_orders_order_number_key unique (order_number),
  constraint client_orders_agency_id_fkey foreign KEY (agency_id) references auth.users (id) on delete CASCADE,
  constraint client_orders_client_id_fkey foreign KEY (client_id) references clients (id) on delete CASCADE,
  constraint client_orders_frequency_check check (
    (
      frequency = any (
        array[
          'once'::text,
          'daily'::text,
          'weekly'::text,
          'biweekly'::text,
          'monthly'::text,
          'custom'::text
        ]
      )
    )
  ),
  constraint client_orders_status_check check (
    (
      status = any (
        array[
          'draft'::text,
          'submitted'::text,
          'active'::text,
          'completed'::text,
          'cancelled'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_client_orders_client_id on public.client_orders using btree (client_id) TABLESPACE pg_default;

create index IF not exists idx_client_orders_agency_id on public.client_orders using btree (agency_id) TABLESPACE pg_default;

create index IF not exists idx_client_orders_start_date on public.client_orders using btree (start_date) TABLESPACE pg_default;

create trigger update_client_orders_updated_at BEFORE
update on client_orders for EACH row
execute FUNCTION update_updated_at_column ();