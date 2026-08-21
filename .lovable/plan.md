# 2C-2 Step 1 — Proposed model: Care Requests + Caregiver Preferences (additive only)

No UI. No changes to 2A RLS on existing tables, 2B triggers, or 2.5 eligibility functions.

## A. care_requests

### Ownership decision
**Recommend: `client_id` nullable + `family_id` NOT NULL-ish is wrong; use both, family required only when client is unknown.**

Concretely: `family_id` NULL-able FK, `client_id` NULL-able FK, plus a CHECK that at least one is present (`client_id IS NOT NULL OR family_id IS NOT NULL`). Rationale: a first-contact request often arrives family-level ("mother needs weekend help") before the client record exists; once a client is created the request is narrowed by setting `client_id`. A single mandatory `client_id` would force fake client rows at intake; a family-only model would lose precision for existing clients. Tenancy is carried explicitly by `agency_id NOT NULL` and `virtual_office_id` nullable (2C-1 pattern) so RLS never has to walk an optional FK.

### Lifecycle
**Recommend a Postgres enum** (`care_request_status`) — matches the existing convention (`shift_status`, `request_status`) and gives type safety in generated types.

| value | meaning |
|---|---|
| `new` | captured, not yet triaged |
| `reviewing` | staff triaging / qualifying the need |
| `matched` | candidate caregiver(s) identified (future matching output), nothing scheduled |
| `scheduled` | shifts exist covering the request |
| `fulfilled` | care delivered, request closed |
| `cancelled` | withdrawn or declined |

No trigger enforces transitions this phase — status is plain storage.

### Table
```
care_requests
  id                     uuid PK default gen_random_uuid()
  agency_id              uuid NOT NULL FK -> agency(id) CASCADE
  virtual_office_id      uuid NULL FK -> virtual_office(id) SET NULL
  family_id              uuid NULL FK -> families(id) SET NULL
  client_id              uuid NULL FK -> clients(id) SET NULL
  request_number         text NULL                 -- optional human ref, no generator this phase
  status                 care_request_status NOT NULL default 'new'
  source                 text NOT NULL default 'staff'   -- CHECK in ('staff','family_portal','assistant_intake','phone','other')
  priority               text NOT NULL default 'normal'  -- CHECK in ('low','normal','high','urgent')
  care_type_codes        text[] NOT NULL default '{}'    -- requested services (no FK: array)
  requested_start_date   date NULL
  requested_end_date     date NULL
  requested_start_time   time NULL
  requested_end_time     time NULL
  recurrence_hint        text NULL          -- free text/one_time/weekly hint, not a schedule
  estimated_hours_per_week numeric NULL
  location_address/city/state/zip_code  text NULL
  requested_caregiver_id uuid NULL FK -> caregivers(id) SET NULL
  notes                  text NULL
  created_by             uuid NULL FK -> auth.users(id) SET NULL
  is_demo                boolean NOT NULL default false
  created_at/updated_at  timestamptz NOT NULL default now()  (updated_at trigger reuses update_updated_at_column())
```
`care_type_codes` stays an array (mirrors `clients.care_requirements` / `shifts.required_skills`); a child table buys nothing until matching queries exist.

### Link to shifts
**Recommend: nullable `shifts.care_request_id uuid NULL FK -> care_requests(id) ON DELETE SET NULL`.** Least coupled: no join table to maintain, no shift row required for a request, and fulfillment stays a later phase's job (something will simply stamp the column when it generates shifts). The column is inert this phase — nothing reads or writes it, no trigger, no default, and 2B's assignment triggers are untouched. A join table would only be needed if one shift could serve many requests; that is not a real case.

### Why this is not client_orders
`client_orders` + `order_services` is a **standing, approved care plan**: recurring service lines with fixed weekdays/times that generate shifts on a schedule. `care_requests` is a **demand-side intake record**: an unapproved, possibly family-level, possibly one-off ask that may have no times yet, may be declined, and produces nothing until staff act. A care plan line is an obligation; a care request is a question. No column is duplicated with intent to mirror: requests hold "what was asked for", plans hold "what we committed to". A request that becomes ongoing care ends as a care plan (future phase), and the request closes as `fulfilled` — it does not shadow the plan.

## B. caregiver_preferences

### Location decision
**Recommend a new 1:1 `caregiver_preferences` table**, not more columns on `caregivers`. `caregivers` is already the overloaded row the audit flagged (identity + employment + address + service area + performance + demo flags). Preferences are optional, edited by a different actor (the caregiver, via self-service), and read by exactly one future consumer (the optimizer) — a separate table gives a clean caregiver-writes-own-row RLS policy without widening write access to the roster row.

### Existing preference-like columns already on caregivers (report only — none touched)
| column | today's meaning | direction |
|---|---|---|
| `service_zipcodes text[]` | operational service area used by 2.5 eligibility (`service_area` flag) | **leave.** It is an agency-set constraint, not a caregiver wish. Preferences get a separate `preferred_zip_codes`. |
| `service_radius_miles int` | agency-set radius | leave; preferences get `max_travel_miles` (caregiver's own limit) |
| `custom_min_hours int` | contractual minimum used for scheduling floors | leave; preferences get `desired_weekly_hours` (a target, not a floor) |
| `availability jsonb` + `caregiver_availability` table | hard availability windows, a 2.5 hard/soft rule | leave. Preferences' `preferred_days` / `preferred_time_of_day` are softer wishes for optimization, never eligibility. |
| `employment_type`, `hourly_rate` | employment terms | leave |
| `caregiver_skills` | qualifications (eligibility) | leave; preferences get `preferred_care_type_codes` (willingness ≠ qualification) |

Recommended direction (later phase, not now): keep the eligibility-facing columns authoritative on `caregivers`/`caregiver_availability`; keep `caregiver_preferences` strictly advisory input to optimization. No consolidation or drop this phase.

### Table
```
caregiver_preferences
  id                      uuid PK default gen_random_uuid()
  caregiver_id            uuid NOT NULL UNIQUE FK -> caregivers(id) CASCADE   -- 1:1
  agency_id               uuid NOT NULL FK -> agency(id) CASCADE              -- tenancy, set from caregiver
  preferred_zip_codes     text[] NOT NULL default '{}'
  preferred_cities        text[] NOT NULL default '{}'
  max_travel_miles        numeric NULL
  max_travel_minutes      integer NULL
  preferred_days          integer[] NOT NULL default '{}'   -- 0=Sun..6=Sat, matches caregiver_availability
  preferred_time_of_day   text[] NOT NULL default '{}'      -- 'morning','afternoon','evening','overnight'
  preferred_start_time    time NULL
  preferred_end_time      time NULL
  desired_weekly_hours    numeric NULL
  min_weekly_hours        numeric NULL
  max_weekly_hours        numeric NULL       -- caregiver's own cap; does NOT override agency cap in 2.5
  desired_weekly_earnings numeric NULL
  desired_hourly_rate     numeric NULL
  flexibility             text NOT NULL default 'flexible'  -- CHECK in ('strict','moderate','flexible')
  willing_to_travel_outside_area boolean NOT NULL default false
  open_to_short_notice    boolean NOT NULL default false
  preferred_care_type_codes text[] NOT NULL default '{}'
  notes                   text NULL
  is_demo                 boolean NOT NULL default false
  created_at/updated_at   timestamptz NOT NULL default now()
```
"Flexibility" is a three-value constrained text scale (`strict|moderate|flexible`) rather than a 1-10 number — an enum-like scale is meaningful to both a caregiver form and a future weighting function; a raw integer would be uninterpretable. Every substantive field is nullable or defaults empty, so an unset caregiver is valid and the whole row is optional.

## C. Cross-cutting

**is_demo:** added to both new tables, NOT NULL default false. **No backfill and no flagged rows** — both tables are created empty; nothing existing gains a demo flag. Confirmed.

**Purge order** — extend the ordered delete list only, guard logic unchanged:
```
… shift_ratings → shift_assignments → shifts
  → care_requests                      (after shifts: shifts.care_request_id is SET NULL, but delete after so demo shifts go first)
  → client_care_needs → … → clients
  → caregiver_preferences              (immediately before caregivers)
  → caregivers → family_contacts → families → virtual_office
```
`caregiver_preferences.caregiver_id` is CASCADE, so it would follow the caregiver anyway; the explicit delete keeps the returned per-table count honest.

**RLS (new tables only), 2A-consistent. GRANTs in the same migration: SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`, no `anon`.**

`care_requests`
- SELECT: `agency_id = current_agency_id()` (any authenticated member of the agency) OR `client_id IN (SELECT my_client_ids())` OR `family_id IN (SELECT family_id FROM clients WHERE id IN (SELECT my_client_ids()))`.
- INSERT/UPDATE/DELETE: `is_agency_staff(auth.uid()) AND agency_id = current_agency_id()`.
- `system_admin` full access via `has_role(auth.uid(),'system_admin')`.

`caregiver_preferences`
- SELECT: own row (`caregiver_id IN (SELECT my_caregiver_ids())`) OR agency staff in the same agency OR system_admin.
- INSERT: `caregiver_id IN (SELECT my_caregiver_ids())` (self) OR agency staff in same agency.
- UPDATE: same as INSERT, with USING **and** WITH CHECK both scoped — so a caregiver can edit only their own row and cannot re-point `caregiver_id` at someone else. **Confirmed: no caregiver can write another caregiver's preferences.**
- DELETE: agency staff / system_admin only.

**Constraint list**
| kind | detail |
|---|---|
| ENUM | `care_request_status` = new, reviewing, matched, scheduled, fulfilled, cancelled |
| FK | `care_requests.agency_id → agency.id` NOT NULL CASCADE |
| FK | `care_requests.virtual_office_id → virtual_office.id` NULL SET NULL |
| FK | `care_requests.family_id → families.id` NULL SET NULL |
| FK | `care_requests.client_id → clients.id` NULL SET NULL |
| FK | `care_requests.requested_caregiver_id → caregivers.id` NULL SET NULL |
| FK | `care_requests.created_by → auth.users.id` NULL SET NULL |
| FK | `shifts.care_request_id → care_requests.id` NULL SET NULL (new nullable column on existing table) |
| FK | `caregiver_preferences.caregiver_id → caregivers.id` NOT NULL CASCADE |
| FK | `caregiver_preferences.agency_id → agency.id` NOT NULL CASCADE |
| UNIQUE | `caregiver_preferences.caregiver_id` (enforces 1:1) |
| CHECK | care_requests: `client_id IS NOT NULL OR family_id IS NOT NULL` |
| CHECK | care_requests: `source IN (...)`, `priority IN (...)`, `requested_end_date >= requested_start_date` when both present |
| CHECK | caregiver_preferences: `flexibility IN ('strict','moderate','flexible')` |
| NOT NULL | care_requests: agency_id, status, source, priority, care_type_codes, is_demo, timestamps |
| NOT NULL | caregiver_preferences: caregiver_id, agency_id, array columns, flexibility, the two booleans, is_demo, timestamps |

**Confirmation:** the only write to an existing table is adding the nullable, unindexed-by-default, inert `shifts.care_request_id` column. No existing column is dropped, retyped, or re-meaninged; no existing row's data changes; 2.5 eligibility, 2B triggers, and 2A policies are untouched.

## Step 2 (after approval)
Create the enum, two tables, the one nullable shift column, constraints, RLS + GRANTs, extend the purge list; then validate counts, FKs, one 2.5 eligibility run, and unchanged clients/caregivers/shifts/assignment counts and linter classes.
