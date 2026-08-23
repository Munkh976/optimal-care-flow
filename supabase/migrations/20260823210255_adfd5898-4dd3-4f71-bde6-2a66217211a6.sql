-- 1. Additive columns
ALTER TABLE public.virtual_office
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS public_content jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS virtual_office_slug_key ON public.virtual_office (slug) WHERE slug IS NOT NULL;

ALTER TABLE public.virtual_office
  DROP CONSTRAINT IF EXISTS virtual_office_slug_chk;
ALTER TABLE public.virtual_office
  ADD CONSTRAINT virtual_office_slug_chk CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,62}$');

-- 2. Public read function (whitelisted fields only)
CREATE OR REPLACE FUNCTION public.get_public_office(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'virtual_office_id', v.id,
    'agency_id', v.agency_id,
    'slug', v.slug,
    'name', v.name,
    'agency_name', a.agency_name,
    'branding', v.branding,
    'public_content', v.public_content,
    'service_states', to_jsonb(v.service_states),
    'service_zipcodes', to_jsonb(v.service_zipcodes),
    'service_area', v.service_area,
    'operating_hours', v.operating_hours,
    'contact_email', v.contact_email,
    'contact_phone', v.contact_phone,
    'address', v.address,
    'city', v.city,
    'state', v.state,
    'zip_code', v.zip_code,
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'code', ct.code,
               'name', ct.name,
               'category', ct.category,
               'description', ct.description
             ) ORDER BY ct.category, ct.name)
      FROM public.care_types ct
      WHERE ct.is_active
        AND (
          NOT (v.public_content ? 'service_codes')
          OR jsonb_array_length(COALESCE(v.public_content->'service_codes','[]'::jsonb)) = 0
          OR v.public_content->'service_codes' ? ct.code
        )
    ), '[]'::jsonb)
  )
  FROM public.virtual_office v
  JOIN public.agency a ON a.id = v.agency_id
  WHERE v.slug = lower(btrim(p_slug))
    AND v.is_active
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_office(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_office(text) TO anon, authenticated;

-- 3. Intake submission can scope to an agency/office and create a care request
CREATE OR REPLACE FUNCTION public.flow_session_submit_intake(
  p_session_id uuid,
  p_token text,
  p_name text,
  p_phone text,
  p_email text,
  p_preference text,
  p_total_score numeric DEFAULT 0,
  p_trait_scores jsonb DEFAULT '{}'::jsonb,
  p_agency_id uuid DEFAULT NULL,
  p_virtual_office_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated uuid;
  v_family_id uuid;
  v_name text := NULLIF(btrim(p_name), '');
BEGIN
  UPDATE public.conversation_sessions
  SET status = 'submitted'::conversation_session_status,
      submitted_at = now(),
      completed_at = now(),
      current_node_id = NULL,
      total_score = p_total_score,
      trait_scores = p_trait_scores,
      client_name = v_name,
      client_phone = NULLIF(btrim(p_phone), ''),
      client_email = NULLIF(btrim(p_email), ''),
      contact_preference = NULLIF(btrim(p_preference), ''),
      contact_name = COALESCE(v_name, contact_name),
      contact_email = COALESCE(NULLIF(btrim(p_email), ''), contact_email),
      contact_phone = COALESCE(NULLIF(btrim(p_phone), ''), contact_phone),
      agency_id = COALESCE(p_agency_id, agency_id)
  WHERE id = p_session_id
    AND session_token = p_token
  RETURNING id INTO v_updated;

  IF v_updated IS NULL OR p_agency_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.families (agency_id, virtual_office_id, family_name, notes, is_demo)
  VALUES (
    p_agency_id,
    p_virtual_office_id,
    COALESCE(v_name, 'Website inquiry') || ' family',
    'Created from the public website intake assistant.',
    false
  )
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_contacts (family_id, first_name, last_name, email, phone, is_primary, is_decision_maker, is_demo)
  VALUES (
    v_family_id,
    COALESCE(split_part(COALESCE(v_name, 'Website inquiry'), ' ', 1), 'Website'),
    NULLIF(btrim(substr(COALESCE(v_name, ''), length(split_part(COALESCE(v_name, ''), ' ', 1)) + 1)), ''),
    NULLIF(btrim(p_email), ''),
    NULLIF(btrim(p_phone), ''),
    true,
    true,
    false
  );

  INSERT INTO public.care_requests (
    agency_id, virtual_office_id, family_id, status, source, priority,
    care_type_codes, notes, is_demo
  )
  VALUES (
    p_agency_id,
    p_virtual_office_id,
    v_family_id,
    'new'::care_request_status,
    'assistant_intake',
    'normal',
    ARRAY[]::text[],
    'Public site intake. Preferred contact: ' || COALESCE(NULLIF(btrim(p_preference), ''), 'not set'),
    false
  );
END;
$function$;

-- 4. Seed Kind Care Services as a public office under the pilot agency
INSERT INTO public.virtual_office (
  agency_id, name, code, slug, is_primary, is_active, timezone,
  branding, service_states, service_zipcodes, service_area,
  contact_email, contact_phone, address, city, state, zip_code, is_demo, public_content
)
SELECT
  '56fbfe38-e8eb-40c1-ba27-07428f62ed2e',
  'Kind Care Services',
  'KINDCARE',
  'kind-care',
  false,
  true,
  'America/Chicago',
  jsonb_build_object(
    'display_name', 'Kind Care Services',
    'tagline', 'Compassionate in-home care across Chicago''s North Shore',
    'logo_url', '',
    'primary_color', '#0D9488',
    'secondary_color', '#134E4A'
  ),
  ARRAY['IL'],
  ARRAY['60093','60025','60026','60091','60201','60062'],
  jsonb_build_object('radius_miles', 25, 'center_zip', '60093', 'notes', 'Winnetka and the surrounding North Shore communities.'),
  'hello@kindcareservices.com',
  '(847) 555-0134',
  '577 Chestnut Street',
  'Winnetka',
  'IL',
  '60093',
  false,
  jsonb_build_object(
    'hero_headline', 'Kind, dependable care — right at home',
    'hero_subhead', 'Kind Care Services helps older adults across Winnetka, Glenview and Chicago''s North Shore stay safe, independent and comfortable in the home they love.',
    'story', jsonb_build_object(
      'title', 'Our story',
      'body', 'Kind Care Services was founded by families who searched for care they could trust and decided to build it themselves. Every caregiver we place is background-checked, trained and matched to the person they support — not just to a shift. We keep our teams small and local so the same familiar faces come back week after week.'
    ),
    'service_area_note', 'Serving Winnetka, Glenview and the greater Chicago North Shore.',
    'steps', jsonb_build_array(
      jsonb_build_object('title', 'Free consultation', 'body', 'Tell us about your family''s needs in a short call — no cost, no obligation.'),
      jsonb_build_object('title', 'Personalized care plan', 'body', 'We build a schedule and plan of care around routines, preferences and budget.'),
      jsonb_build_object('title', 'Meet your caregiver', 'body', 'We match a vetted caregiver and introduce them before care begins.'),
      jsonb_build_object('title', 'Ongoing support', 'body', 'A care manager checks in regularly and adjusts the plan as needs change.')
    ),
    'testimonials', jsonb_build_array(
      jsonb_build_object('quote', 'Our caregiver became part of the family. Mom is happier and we finally sleep at night.', 'author', 'Susan M.', 'location', 'Winnetka, IL'),
      jsonb_build_object('quote', 'They answered the phone on a Sunday and had someone with Dad by Monday morning.', 'author', 'David R.', 'location', 'Glenview, IL'),
      jsonb_build_object('quote', 'Reliable, kind and genuinely skilled with dementia care. I recommend them constantly.', 'author', 'Ellen K.', 'location', 'Northfield, IL')
    ),
    'careers_blurb', 'We are hiring caregivers, CNAs and companions across the North Shore. Flexible schedules, competitive pay and a team that answers when you call. Tell us about yourself — it takes about three minutes.',
    'cta_care_label', 'Request a free consultation',
    'cta_careers_label', 'Apply as a caregiver',
    'services_intro', 'Care built around the person, from a few hours a week to around-the-clock support.',
    'service_codes', '[]'::jsonb
  )
WHERE NOT EXISTS (SELECT 1 FROM public.virtual_office WHERE slug = 'kind-care');