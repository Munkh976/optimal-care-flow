export interface PublicOfficeService {
  code: string;
  name: string;
  category: string | null;
  description: string | null;
}

export interface PublicOfficeContent {
  hero_headline?: string;
  hero_subhead?: string;
  hero_image_url?: string;
  services_intro?: string;
  service_area_note?: string;
  story?: { title?: string; body?: string };
  steps?: { title?: string; body?: string }[];
  testimonials?: { quote?: string; author?: string; location?: string }[];
  careers_blurb?: string;
  cta_care_label?: string;
  cta_careers_label?: string;
  service_codes?: string[];
}

export interface PublicOfficeBranding {
  display_name?: string;
  tagline?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface PublicOffice {
  virtual_office_id: string;
  agency_id: string;
  slug: string;
  name: string;
  agency_name: string;
  branding: PublicOfficeBranding | null;
  public_content: PublicOfficeContent | null;
  service_states: string[] | null;
  service_zipcodes: string[] | null;
  service_area: { radius_miles?: number | null; center_zip?: string | null; notes?: string } | null;
  operating_hours: Record<string, { closed: boolean; start: string; end: string }> | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  services: PublicOfficeService[];
}
