-- Step 1: Drop the order_shifts junction table
DROP TABLE IF EXISTS public.order_shifts CASCADE;

-- Step 2: Add order_id column to shifts table (if not exists)
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.client_orders(id) ON DELETE CASCADE;

-- Step 3: Delete all existing shift data
DELETE FROM public.shifts;

-- Step 4: Insert realistic sample shifts with diverse care types
-- Morning shifts with various care types (ADL, IADL, Health, Cognitive, Emotional)
INSERT INTO public.shifts (
  agency_id,
  client_id,
  order_id,
  shift_date,
  start_time,
  end_time,
  duration_hours,
  care_type_code,
  status,
  order_title
)
SELECT 
  co.agency_id,
  co.client_id,
  co.id as order_id,
  (co.start_date + gs.day * INTERVAL '1 day')::date as shift_date,
  '09:00'::time as start_time,
  '11:00'::time as end_time,
  2 as duration_hours,
  CASE 
    WHEN gs.day % 10 = 0 THEN 'CT001'  -- Bathing Assistance
    WHEN gs.day % 10 = 1 THEN 'CT007'  -- Meal Preparation
    WHEN gs.day % 10 = 2 THEN 'CT018'  -- Companionship
    WHEN gs.day % 10 = 3 THEN 'CT021'  -- Vital Sign Monitoring
    WHEN gs.day % 10 = 4 THEN 'CT002'  -- Dressing Assistance
    WHEN gs.day % 10 = 5 THEN 'CT008'  -- Housekeeping
    WHEN gs.day % 10 = 6 THEN 'CT016'  -- Memory Support
    WHEN gs.day % 10 = 7 THEN 'CT003'  -- Eating Support
    WHEN gs.day % 10 = 8 THEN 'CT022'  -- Wound Care
    ELSE 'CT005'  -- Mobility Assistance
  END as care_type_code,
  CASE 
    WHEN gs.day % 3 = 0 THEN 'open'::shift_status
    ELSE 'assigned'::shift_status
  END as status,
  'Care Service Order' as order_title
FROM 
  client_orders co
  CROSS JOIN generate_series(0, LEAST((co.end_date - co.start_date)::integer, 30)) as gs(day)
WHERE co.frequency = 'weekly'
LIMIT 50;

-- Afternoon shifts with different care types
INSERT INTO public.shifts (
  agency_id,
  client_id,
  order_id,
  shift_date,
  start_time,
  end_time,
  duration_hours,
  care_type_code,
  status,
  order_title
)
SELECT 
  co.agency_id,
  co.client_id,
  co.id as order_id,
  (co.start_date + gs.day * INTERVAL '1 day')::date as shift_date,
  '14:00'::time as start_time,
  '17:00'::time as end_time,
  3 as duration_hours,
  CASE 
    WHEN gs.day % 8 = 0 THEN 'CT009'  -- Grocery Shopping
    WHEN gs.day % 8 = 1 THEN 'CT019'  -- Behavioral Support
    WHEN gs.day % 8 = 2 THEN 'CT023'  -- Post-Hospital Recovery
    WHEN gs.day % 8 = 3 THEN 'CT004'  -- Toileting Support
    WHEN gs.day % 8 = 4 THEN 'CT025'  -- Home Maintenance
    WHEN gs.day % 8 = 5 THEN 'CT006'  -- Transferring / Positioning
    WHEN gs.day % 8 = 6 THEN 'CT024'  -- Chronic Condition Support
    ELSE 'CT017'  -- Decision-Making Support
  END as care_type_code,
  'open'::shift_status as status,
  'Afternoon Care Service' as order_title
FROM 
  client_orders co
  CROSS JOIN generate_series(0, LEAST((co.end_date - co.start_date)::integer, 20)) as gs(day)
WHERE co.frequency = 'daily'
LIMIT 30;