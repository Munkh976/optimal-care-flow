UPDATE public.system_modules
SET module_name = 'Care Services',
    description = 'Configure Care Services and caregiver service profiles',
    updated_at = now()
WHERE module_code = 'care_types';