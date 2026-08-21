# 2C-1 Step 1 — Proposed model: Virtual Office + Families (additive only)

No UI. No changes to 2A RLS on existing tables, 2B triggers, or 2.5 eligibility functions.

## A. virtual_office

One agency owns many virtual offices; a VO is an operational sub-unit, never a tenant.

```
virtual_office
  id                 uuid PK default gen_random_uuid()
  agency_id          uuid NOT NULL  FK -> agency(id) ON DELETE CASCADE
  name               text NOT NULL
  code               text NULL            -- short label e.g. "VO-MI"
  is_primary         boolean NOT NULL default false
  is_active          boolean NOT NULL default true
  timezone           text NOT NULL default 'America/New_York'
  -- branding
  branding           jsonb NOT NULL default '{}'   -- logo_url, colors, display_name
  -- service area
  service_states     text[] NOT NULL default '{}'
  service_zipcodes   text[] NOT NULL default '{}'
  service_area       jsonb NOT NULL default '{}'   -- future radius/geo detail
  -- operating hours
  operating_hours    jsonb NOT NULL default '{}'   -- { "1": [{"start":"08:00","end":"18:00"}], ... }
  -- scheduling overrides (NULL = inherit from agency)
  max_weekly_hours       integer NULL
  travel_buffer_minutes  integer NULL
  late_trade_hours       integer NULL
  smart_match_weights    jsonb NULL
  contact_email      text NULL
  contact_phone      text NULL
  address/city/state/zip_code  text NULL
  is_demo            boolean NOT NULL default false
  created_at/updated_at timestamptz NOT NULL default now()
```

Constraints: `UNIQUE (agency_id, name)`; partial `UNIQUE (agency_id) WHERE is_primary` (one primary per agency); `updated_at` trigger reusing `update_updated_at_column()`.

**jsonb vs child tables:** service area and operating hours stay jsonb (plus scalar `service_states`/`service_zipcodes` arrays for indexable matching). They are read whole, written whole, and never joined/aggregated — child tables would add joins and RLS surface with no query benefit. Revisit only if we need per-window scheduling queries.

**Scheduling rules — inherit with override:** the four agency columns stay exactly as they are and 2.5 keeps reading them. `virtual_office` carries the same four columns as NULLable overrides. When VO becomes real we introduce a resolver (`effective_scheduling_rules(vo_id)` = `COALESCE(vo.col, agency.col)`) and switch eligibility to it in a later phase. Nothing in this phase reads the override columns — they are inert storage.

## B. families

Target: Agency → Virtual Office → Family → Client → Care Plan → Care Request.

```
families
  id                 uuid PK
  agency_id          uuid NOT NULL FK -> agency(id) ON DELETE CASCADE
  virtual_office_id  uuid NULL FK -> virtual_office(id) ON DELETE SET NULL
  family_name        text NOT NULL          -- e.g. "Johnson Family"
  notes              text NULL
  is_active          boolean NOT NULL default true
  is_demo            boolean NOT NULL default false
  created_at/updated_at timestamptz NOT NULL
```

Minimal split: families holds *grouping* only. No address, phone, or email duplicated from clients — clients keep every field they have today.

```
family_contacts                       -- recommended: child table, not columns
  id                 uuid PK
  family_id          uuid NOT NULL FK -> families(id) ON DELETE CASCADE
  user_id            uuid NULL FK -> auth.users(id) ON DELETE SET NULL
  first_name         text NOT NULL
  last_name          text NOT NULL
  email              text NULL
  phone              text NULL
  relationship       text NULL            -- daughter, POA, spouse
  is_primary         boolean NOT NULL default false
  is_decision_maker  boolean NOT NULL default false
  is_demo            boolean NOT NULL default false
  created_at/updated_at timestamptz NOT NULL
```

Child table wins: a family realistically has several decision-makers (daughter + POA + spouse), each potentially a login. Flattening to columns caps it arbitrarily and blocks per-contact auth linkage.

**Existing clients:** add `clients.family_id uuid NULL FK -> families(id) ON DELETE SET NULL`. Backfill one family per existing client (1:1, name = `"<last_name> Family"`). No client column is modified other than setting the new `family_id`. Client Management UI is untouched — `family_id` is nullable and unused by current code.

**Existing rows → virtual_office:** recommend the least-disruptive path — auto-create one primary VO per agency now, and add nullable `virtual_office_id` to `clients`, `caregivers`, and `families` only, backfilled to the agency's primary VO. Do **not** add it to `shifts` yet: shifts derive their VO through the client/care plan, 156 demo rows would need touching, and 2B triggers sit on that table. Shift-level VO is deferred to the phase that actually routes work by VO.

## C. Cross-cutting

**Backfill + is_demo (exact rows):**
- `virtual_office`: 2 rows (one primary per agency). `System Agency` (sentinel) → `is_demo = false`. `CareMuch Agency` → `is_demo = false` (it is the real tenant; its VO is real infrastructure, not seed data).
- `families`: 5 rows, one per existing client, all 5 → `is_demo = true` (all 5 clients are demo).
- `family_contacts`: 0 rows created — no contact data is invented from clients.
- `clients.family_id`: 5 rows updated. `clients.virtual_office_id`: 5 rows. `caregivers.virtual_office_id`: 8 rows. All point at CareMuch Agency's primary VO.

**Purge order** — extend the ordered delete list only, guard logic unchanged. Append after the existing `caregivers` delete:
```
… shift_trades → … → time_off_requests → clients → caregivers
  → family_contacts → families → virtual_office
```
`clients.family_id` and `*.virtual_office_id` are `ON DELETE SET NULL`, so a demo family/VO delete can never orphan a real client.

**RLS (new tables only), consistent with 2A:**
- `virtual_office`: SELECT for any authenticated user whose `agency_id = virtual_office.agency_id` (via `current_agency_id()`); INSERT/UPDATE/DELETE restricted to `is_agency_staff(auth.uid())` within the same agency; `system_admin` full access.
- `families`: same staff-write / agency-read shape; additionally a client may read their own family (`family_id IN (SELECT family_id FROM clients WHERE id IN (SELECT my_client_ids()))`).
- `family_contacts`: inherits scope through `families` (agency check via a `family_agency_id(_family_id)` SECURITY DEFINER helper, `search_path = public`, mirroring existing helpers); a contact whose `user_id = auth.uid()` may read their own row.
- GRANTs in the same migration: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`; no `anon` grant (no anon policy).

**Full constraint list:**
| constraint | detail |
|---|---|
| FK | `virtual_office.agency_id → agency.id` NOT NULL, CASCADE |
| FK | `families.agency_id → agency.id` NOT NULL, CASCADE |
| FK | `families.virtual_office_id → virtual_office.id` NULL, SET NULL |
| FK | `family_contacts.family_id → families.id` NOT NULL, CASCADE |
| FK | `family_contacts.user_id → auth.users.id` NULL, SET NULL |
| FK | `clients.family_id → families.id` NULL, SET NULL |
| FK | `clients.virtual_office_id → virtual_office.id` NULL, SET NULL |
| FK | `caregivers.virtual_office_id → virtual_office.id` NULL, SET NULL |
| NOT NULL | VO: agency_id, name, is_primary, is_active, timezone, branding, service_states, service_zipcodes, service_area, operating_hours, is_demo, timestamps |
| NOT NULL | families: agency_id, family_name, is_active, is_demo, timestamps |
| NOT NULL | family_contacts: family_id, first_name, last_name, is_primary, is_decision_maker, is_demo, timestamps |
| UNIQUE | `(agency_id, name)` on virtual_office; partial unique primary per agency |

**Confirmation:** the only writes to existing tables are (1) three new nullable link columns (`clients.family_id`, `clients.virtual_office_id`, `caregivers.virtual_office_id`) and (2) their backfills. No existing column is dropped, retyped, or re-meaninged; agency scheduling columns are untouched; 2.5 eligibility continues to read `agency`.

## Step 2 (after approval)
Create tables/columns/constraints/RLS/backfills, extend purge list, then validate row counts, FKs, one 2.5 eligibility run, client resolution, and unchanged shift/assignment counts.
