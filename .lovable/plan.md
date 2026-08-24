# Phase C — Family & Care-Request Workflow (V1)

Additive only. No LLM, no matching/scheduling engine. Extends existing surfaces; no parallel pages.

## a. Conversion path (highest priority)

What a care_request holds vs what a client needs:

| Needed by `clients` | Available on `care_request` |
|---|---|
| first_name / last_name (required) | `conversation_sessions.client_name` (single string) or `families.family_name` |
| phone (required) | `conversation_sessions.client_phone` |
| address / city / state / zip (required) | `location_address`, `location_city`, `location_state`, `location_zip_code` (often partial) |
| email (optional) | `conversation_sessions.client_email` |
| agency_id, virtual_office_id, family_id | already on the request |
| care needs | `care_type_codes[]` → `client_care_needs` |

Because required address fields are frequently incomplete on an inbound request, conversion is a **staff-reviewed dialog**, not a one-click silent insert.

**"Convert to client" action** on each ClientInquiries card:
1. Opens a prefilled dialog (name split from `client_name`, phone/email, address fields, care services from `care_type_codes`, read-only flexibility + time windows).
2. Staff can instead **link an existing client** (searchable select scoped to the agency) rather than creating a new one.
3. On confirm (single RPC, so it is atomic):
   - reuse `care_requests.family_id` if present, else create a `families` row named from the contact;
   - insert `clients` (agency_id + virtual_office_id + family_id from the request) or link the chosen existing client;
   - insert `client_care_needs` rows for each `care_type_code` not already present;
   - set `care_requests.client_id` and status → `matched`.

**Care plan: NOT created at conversion** (least-assuming path). The request's time windows are display-only guidance; staff then click "Create care plan" which opens the existing `OrderWizardDialog` prefilled with the client and the request's service codes/windows. Once a care plan exists for that client, staff can move the request to `scheduled` from the existing status control.

**Idempotency:** conversion is guarded by a new `care_requests.client_id` FK (already present in schema) — the RPC returns the existing client if `client_id` is already set, and the UI shows "Converted → <client name>" with a link instead of the Convert button. Re-running the RPC creates nothing.

## b. Family model usage (minimal)

No new heavy module. Two touches:

- **Clients page:** add a "Family" column/field. In the client add/edit form a family select ("None / existing family / + new family"), so a couple can share one family. Optional "Group by family" toggle on the list — pure presentation.
- **Family detail drawer** (opened from a client row or from ClientInquiries): family name, notes, the clients belonging to it, and CRUD for `family_contacts` (name, relationship, phone/email, primary, decision-maker). Contact info lives only on contacts — no duplication of client contact data onto families.

Existing clients already linked 1:1 to a family keep working; `family_id` stays nullable.

## c. Family Care Circle (extend ClientDashboard)

Add one tab, "Care Circle", to the existing family portal (Care Team tab stays; Care Circle is the relationship-framed view):
- **Primary caregiver** = caregiver with the most non-cancelled upcoming/recent assignments for this client.
- **Backup caregiver(s)** = the remaining assigned caregivers.
- **Care team** roster, reusing the existing `shift_assignments` read in `CareTeam.tsx` (extracted into a small shared hook, component unchanged in behaviour).
- **Requested schedule** — the client's care-request time windows / care-plan lines, read-only.
Scoped strictly to the signed-in client's own records. No other families, no community, no engine.

## d. Flexibility display

`care_requests.flexibility` and `care_request_time_windows.flexibility` render as a labelled badge (Continuity / Balanced / Flexible) on the inquiry card, in the conversion dialog, and in the Care Circle "requested schedule" block. Display-only — nothing reads it for decisions.

## e. Security

- New RPC `convert_care_request_to_client(...)` is `SECURITY DEFINER`, `search_path = public`, and starts by asserting the caller is agency staff for the request's `agency_id` (`is_agency_staff` + `current_agency_id()`); otherwise it raises. All inserts carry that same `agency_id`.
- `families` / `family_contacts` already have agency-scoped staff policies from 2C-1; family-contact CRUD uses them as-is. Any missing INSERT/UPDATE/DELETE policy for staff on `family_contacts` is added agency-scoped.
- No anon grants, no new anon-readable path, no changes to 2A RLS, 2B triggers, 2.5 eligibility, the public page, Phase A, or Phase B.

## f. Additive surface

Tables/columns touched:
- `care_requests.client_id` — existing column/FK, now actually written (conversion marker).
- New function `public.convert_care_request_to_client`.
- Possible new policy on `family_contacts` (staff write) only if absent.
- No column drops, no type changes, no new tables.

Unchanged: Clients CRUD, ClientDashboard existing tabs, ClientInquiries list/status/notes, care-plan generation and `order_services`. Additions are the Convert action, family grouping/contacts, the Care Circle tab, and flexibility badges.
