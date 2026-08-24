# Staff-Editable Flexibility & Preferences — Step 1: Inspection & Proposal

Display + edit only. No engine, no LLM, no optimizer. Nothing in 2A RLS, 2B triggers, 2.5 eligibility, anon grants, the public page, or Phase A/B/C behaviour changes except adding staff-editing surfaces and one durable client attribute.

## a. Caregiver side — what exists today

Editable surfaces found:
- `AvailabilityDialog` (weekly pattern with preferred/acceptable windows + flex minutes, and date exceptions) is already mounted in **both** the caregiver's own settings (`CaregiverProfileSettings`) and the **staff Caregivers management page** (`src/pages/Caregivers.tsx`, row action "Manage Availability"). So structured availability is already staff-editable.
- **Gap:** `caregiver_preferences` (flexibility stance, desired/min/max weekly hours, desired rate/earnings, travel limits, preferred days/areas, short-notice, notes) has **no UI at all** — neither staff nor caregiver. The table is populated only by intake defaults.

RLS check (no changes needed):
- `caregiver_availability` — "Agency users can manage caregiver availability" (ALL, agency match via profiles) + caregiver-self policy. Staff can already write.
- `caregiver_availability_exceptions` — `cae_*` policies allow system admin, the caregiver themself, or agency staff scoped to `current_agency_id()`.
- `caregiver_preferences` — `select`/`update` allow system admin, own caregiver, or agency staff in the same agency; `insert`/`delete` are staff/admin only. Agency-scoped, already correct.

Proposal: add a **"Preferences" tab inside the existing `AvailabilityDialog`** (renamed header to "Availability & Preferences"). It upserts one `caregiver_preferences` row keyed by `caregiver_id`, with `agency_id` taken from the caregiver. Fields: flexibility stance (continuity / balanced / flexible), desired / min / max weekly hours, desired hourly rate, max travel minutes & miles, willing-to-travel-outside-area, open-to-short-notice, notes. Because the dialog is shared, the same tab appears in the caregiver's own settings — which their own RLS already permits.

## b. Client side — the durability question

Today flexibility is **only historical**: it lives on `care_requests.flexibility` and `care_request_time_windows` (day-of-week preferred/earliest/latest + per-window flexibility). `clients` and `families` have **no flexibility column** (verified: zero matching columns). `CareCircle` currently reads the client's most recent care request — so once a request is converted and archived, or if the family's needs change, there is no editable ongoing stance.

Proposed durable model (additive):
1. `clients.scheduling_flexibility text not null default 'balanced'` with a check constraint matching the caregiver side (`continuity` | `balanced` | `flexible`), plus `clients.scheduling_notes text`.
2. New table `public.client_time_windows` mirroring the request-window shape: `client_id`, `agency_id`, `day_of_week`, `preferred_start/end`, `earliest_start`, `latest_end`, `min_duration_hours`, `preferred_duration_hours`, `notes`, `is_demo`, timestamps. Staff-only + client-read RLS, agency-scoped, with GRANTs.
3. **History preserved:** `care_requests.flexibility` and `care_request_time_windows` are never modified or deleted. Conversion seeds the client's durable values *once* from the request (backfill for already-converted clients too); afterwards the client value is the live one and the request keeps its intake snapshot forever.

## c. Scope, security, Care Circle

- Both edit surfaces are staff-only and agency-scoped (client windows: staff write / the client themself read-only; caregiver prefs: staff write, caregiver self-edit as RLS already allows). Cross-agency writes are blocked by `current_agency_id()`.
- Columns added: `clients.scheduling_flexibility`, `clients.scheduling_notes`, and the new `client_time_windows` table. Nothing removed or renamed.
- Care Circle keeps the exact same layout and `FlexibilityBadge`; it just prefers the durable client value and `client_time_windows`, falling back to the latest request's values when the client has none.

## d. Confirmation

Display + edit only. No scheduler, matcher, or eligibility rule reads these new fields — `check_assignment_eligibility` and `shiftEligibility.ts` stay untouched (they continue to use availability windows and exceptions, which already existed). Optimizing on flexibility remains V1.5.

## Files to touch (implementation step)

- `supabase` migration: client columns + `client_time_windows` + RLS/GRANTs + one-time backfill from converted requests.
- `src/components/caregivers/AvailabilityDialog.tsx` — add Preferences tab.
- `src/components/clients/ClientSchedulingDialog.tsx` (new) — flexibility stance + weekly time windows.
- `src/pages/Clients.tsx` — row action to open it.
- `src/components/client-dashboard/CareCircle.tsx` — read durable values with request fallback.
