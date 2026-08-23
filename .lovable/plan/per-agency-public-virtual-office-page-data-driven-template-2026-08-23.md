# Per-agency public virtual-office page (data-driven template)

Step 1 — inspection findings and proposal. Nothing built yet.

## a. Routing

Existing top-level routes: `/`, `/auth`, `/dashboard`, `/schedule`, `/caregivers`, `/clients`,
`/client-inquiries`, `/time-off`, `/live-operations`, `/quick-assign`, `/shift-trades`,
`/caregiver-registration`, `/assistant`, `/flow-builder`, `/caregiver-approvals`,
`/notifications-outbox`, `/caregiver-dashboard`, `/client-dashboard`, `/users`, `/user-roles`,
`/system-roles`, `/role-permissions`, `/system-admin`, `/system-admin-dashboard`, `/care-types`,
`/care-service-categories`, `/order-management`, `/available-shifts`, `/caregiver-time-off`,
`/caregiver-settings`, `/admin-utilities`, `/agency-settings`, `/virtual-offices`,
`/auto-schedule`, `/reports`, `/admin-user-management`, `/.lovable/oauth/consent`, `*`.

Recommendation: **`/a/:slug`** (plus `/a/:slug/apply` and `/a/:slug/care` for deep-linked CTAs).
A bare `/:slug` would shadow every future top-level route and force a slug blacklist. `/a/...` is
collision-proof today and forever. Index.tsx stays the corporate page at `/`.

Slug resolution: add `slug text unique` (nullable, lowercase, `^[a-z0-9-]+$` check) to
**`virtual_office`** — not `agency` — because the virtual office is already the branded,
per-location entity with branding/service area/contact, and a single agency may later publish
several offices. The slug is set by agency admins from the existing Virtual Office config page
(new "Public page" tab) and by the seed migration for Kind Care.

## b. Public (anon) read path

Recommended: a **SECURITY DEFINER function** `public.get_public_office(p_slug text)` returning a
single json object with only whitelisted fields:

`slug, name, agency_name, branding (display_name, tagline, logo_url, primary_color,
secondary_color), service_states, service_zipcodes, service_area (radius/center/notes),
operating_hours, contact_email, contact_phone, address, city, state, zip_code, public_content,
services[] (code, name, description, category from care_types where is_active), agency_id,
virtual_office_id`.

It filters `is_active = true and slug is not null`, returns NULL for unknown slugs, and is granted
`EXECUTE TO anon, authenticated`. No new anon SELECT policy, no public view, no column-level
grants — anon keeps zero table read access, so `caregivers`, `clients`, `shifts` and non-public
`agency` columns stay unreachable. This is safer than a narrow anon policy because the field
whitelist lives in one function instead of relying on clients selecting the right columns.

## c. Content model gap

Reuse existing data:
- Services → `care_types` / `care_service_categories` (already the catalogue; returned by the RPC).
- Service area → `virtual_office.service_states`, `service_zipcodes`, `service_area`.
- Contact/brand → `virtual_office.branding`, `contact_email/phone`, address fields.
- Hours → `virtual_office.operating_hours`.

Gap: story, testimonials, steps, careers blurb, hero copy. Add **one** nullable jsonb column
`virtual_office.public_content` (default `{}`):

```text
{
  hero_headline, hero_subhead, hero_image_url,
  story: { title, body },
  service_area_note,
  steps: [{ title, body }],
  testimonials: [{ quote, author, location }],
  careers_blurb,
  cta_care_label, cta_careers_label,
  service_codes: ["ADL0001", ...]   // optional curation/ordering of the shown services
}
```

Every key optional; missing keys render as omitted sections. No new tables. `public_content` for
Kind Care is real content, so `is_demo` stays false and nothing is added to the purge order
(the column lives on an already-purge-aware table).

## d. CTA scoping

Both flows already run anonymously with client-generated `conversation_sessions` id + token, and
`conversation_sessions.agency_id` already exists — it is simply never set today.

- Caregiver: page renders the existing `ConversationSurface` with the office's agency name; on
  submit, `ResultRegistration` inserts into `caregiver_registrations` — I will pass
  `agencyId` down so the row carries `agency_id` (column already exists, currently left null and
  patched at approval time). Approval flow is unchanged.
- Family: today `flow_session_submit_intake` only stores contact details on the session, and
  `/client-inquiries` reads sessions — no `care_request` row is created. To meet the requirement,
  the RPC gains two optional args (`p_agency_id`, `p_virtual_office_id`) and, when an agency is
  supplied, also inserts a `care_requests` row (`source='public_site'`, `status='new'`,
  `is_demo=false`) linked to the session's contact info. Signature stays backward compatible so
  `/assistant` and the homepage widget keep working unchanged.

The session rows themselves also get the `agency_id`/`virtual_office_id` stamped at creation via a
new optional `scope` option on `useConversationFlow`.

## e. Page structure

New route component `src/pages/PublicOffice.tsx` + `src/components/public-office/`:

- `OfficeHeader` — logo/display name, nav anchors, "Request care" button.
- `HeroSection` — headline/subhead from `public_content`, dual CTA.
- `ServicesSection` — cards from the resolved care services.
- `ServiceAreaSection` — cities/states/zips + note.
- `StorySection` — about/our story.
- `HowItWorksSection` — numbered steps.
- `TestimonialsSection` — quote cards (hidden when empty).
- `CareersSection` — careers blurb + "Apply as a caregiver".
- `CtaSection` + `OfficeFooter` — contact, hours, address.
- `OfficeConversationDialog` — full-screen dialog hosting the existing `ConversationSurface`
  (embedded) or `FamilyIntakeSurface`, opened by either CTA and by `/a/:slug/apply|/care`.

Branding: `primary_color`/`secondary_color` injected as scoped CSS variables on the page root so
the template themes per agency without hardcoded colors; shadcn Card/Button/Dialog reused.
Unknown/inactive slug → friendly not-found panel with a link back to `/`.

## Step 2 test plan

`/a/kind-care` renders from data; a temporary second slug proves the template is data-driven then
is removed; anon reads of `caregivers`/`clients`/`shifts` still fail; caregiver CTA writes a
`caregiver_registrations` row with Kind Care's `agency_id`; family CTA writes a `care_requests`
row under Kind Care; unknown slug shows not-found; Index.tsx and all authenticated pages untouched.
