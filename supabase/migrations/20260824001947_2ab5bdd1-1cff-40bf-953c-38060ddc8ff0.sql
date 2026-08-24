CREATE OR REPLACE FUNCTION public.convert_care_request_to_client(
  p_request_id uuid,
  p_existing_client_id uuid DEFAULT NULL,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip_code text DEFAULT NULL,
  p_care_type_codes text[] DEFAULT '{}'::text[],
  p_family_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.care_requests%ROWTYPE;
  v_client_id uuid;
  v_family_id uuid;
  v_created boolean := false;
  v_code text;
BEGIN
  SELECT * INTO v_req FROM public.care_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Care request not found';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'system_admin'::app_role)
    OR (public.is_agency_staff(auth.uid()) AND public.current_agency_id() = v_req.agency_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this agency';
  END IF;

  -- Idempotency: this request was already converted
  IF v_req.client_id IS NOT NULL THEN
    RETURN jsonb_build_object('client_id', v_req.client_id, 'created', false, 'already_converted', true);
  END IF;

  IF p_existing_client_id IS NOT NULL THEN
    SELECT id, family_id INTO v_client_id, v_family_id
    FROM public.clients
    WHERE id = p_existing_client_id AND agency_id = v_req.agency_id;
    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Client not found in this agency';
    END IF;
    -- Never clobber an existing client's family link.
  ELSE
    v_family_id := v_req.family_id;
    IF v_family_id IS NULL THEN
      INSERT INTO public.families (agency_id, virtual_office_id, family_name, is_demo)
      VALUES (
        v_req.agency_id,
        v_req.virtual_office_id,
        COALESCE(NULLIF(btrim(p_family_name), ''), NULLIF(btrim(COALESCE(p_last_name, '')), '') || ' Family', 'New Family'),
        v_req.is_demo
      )
      RETURNING id INTO v_family_id;
    END IF;

    INSERT INTO public.clients (
      agency_id, virtual_office_id, family_id,
      first_name, last_name, email, phone,
      address, city, state, zip_code,
      is_active, is_demo
    ) VALUES (
      v_req.agency_id, v_req.virtual_office_id, v_family_id,
      COALESCE(NULLIF(btrim(COALESCE(p_first_name, '')), ''), 'Unknown'),
      COALESCE(NULLIF(btrim(COALESCE(p_last_name, '')), ''), 'Client'),
      NULLIF(btrim(COALESCE(p_email, '')), ''),
      COALESCE(NULLIF(btrim(COALESCE(p_phone, '')), ''), 'N/A'),
      COALESCE(NULLIF(btrim(COALESCE(p_address, '')), ''), COALESCE(v_req.location_address, 'N/A')),
      COALESCE(NULLIF(btrim(COALESCE(p_city, '')), ''), COALESCE(v_req.location_city, 'N/A')),
      COALESCE(NULLIF(btrim(COALESCE(p_state, '')), ''), COALESCE(v_req.location_state, 'N/A')),
      COALESCE(NULLIF(btrim(COALESCE(p_zip_code, '')), ''), COALESCE(v_req.location_zip_code, 'N/A')),
      true, v_req.is_demo
    )
    RETURNING id INTO v_client_id;
    v_created := true;
  END IF;

  FOREACH v_code IN ARRAY COALESCE(p_care_type_codes, '{}'::text[]) LOOP
    IF v_code IS NOT NULL AND btrim(v_code) <> ''
       AND EXISTS (SELECT 1 FROM public.care_types ct WHERE ct.code = v_code) THEN
      INSERT INTO public.client_care_needs (client_id, care_type_code, priority, is_demo)
      SELECT v_client_id, v_code, 1, v_req.is_demo
      WHERE NOT EXISTS (
        SELECT 1 FROM public.client_care_needs ccn
        WHERE ccn.client_id = v_client_id AND ccn.care_type_code = v_code
      );
    END IF;
  END LOOP;

  UPDATE public.care_requests
  SET client_id = v_client_id,
      family_id = COALESCE(family_id, v_family_id),
      status = CASE WHEN status IN ('scheduled','fulfilled','cancelled') THEN status ELSE 'matched'::care_request_status END,
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('client_id', v_client_id, 'created', v_created, 'already_converted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.convert_care_request_to_client(uuid, uuid, text, text, text, text, text, text, text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_care_request_to_client(uuid, uuid, text, text, text, text, text, text, text, text, text[], text) TO authenticated;