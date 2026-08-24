# Phase B — Structured Availability Model (V1 data foundation)

Step 1: inspection findings and proposal. No code written yet.

## a. Current state (measured)

| Source | Content today | Read by |
|---|---|---|
| `caregivers.availability` (jsonb) | 8 of 8 caregivers hold `{}` — **empty, zero real data** | Not read by scheduling or eligibility. Only echoed in some profile/import code paths |
| `caregiver_registrations.availability` (jsonb) | 16 rows, all `{}` — applicants never fill it | Displayed nowhere meaningful |
| `caregiver_availability` (table) | 3 rows, all for one caregiver (Tim): Mon/Tue/Thu 09:00–17:00, `is_available=true` | **Authoritative today**: `check_assignment_eligibility` (2.5) reads it (soft blocker `availability`), `AvailabilityDialog` writes it, `CaregiverAvailability` dashboard card reads it |

No overlap in practice (JSON is empty everywhere), so there is no drift to reconcile and no
risk migrating.

**Recommendation:** `caregiver_availability` becomes the single source of truth, extended in
place. The two JSON columns are marked deprecated (kept, not dropped), stop being written by
app code, and get a comment noting they are legacy/derived.

Migration result expectation: 0 JSON records to move (all empty), 3 existing rows preserved
as-is with new columns defaulted so eligibility outcomes are byte-identical.

## b. Caregiver availability model

Extend `caregiver_availability` (keeps existing rows and the FK):

- add `agency_id uuid` (FK `agency`, backfilled from caregiver, NOT NULL after backfill)
- add `preferred_start time`, `preferred_end time` — backfilled from existing `start_time`/`end_time`
- add `earliest_start time`, `latest_end time` — backfilled from existing values
- add `flexibility_minutes int not null default 0`
- keep `start_time`/`end_time` as the effective window eligibility reads (so 2.5 behaviour is unchanged);
  they stay in sync with `earliest_start`/`latest_end` via a small BEFORE trigger

Hours intent is **per-caregiver, one row**, not per day — `min`/`desired`/`max` weekly hours are
a workweek stance, not a daily one. `caregiver_preferences` already has
`min_weekly_hours` / `desired_weekly_hours` / `max_weekly_hours` and is currently empty (0 rows),
so no new table: hours intent lives there and gets the capture UI.

Date exceptions (new, the old table lacked them):

```
caregiver_availability_exceptions
  id, caregiver_id FK, agency_id FK,
  exception_date date, is_available boolean not null default false,
  start_time time null, end_time time null,   -- set only for "available differently" days
  reason text, is_demo boolean not null default false,
  created_at, updated_at
  UNIQUE (caregiver_id, exception_date)
```

Approved time off stays where it is (`time_off_requests`) — exceptions are for one-off
availability edits, not PTO, and eligibility keeps checking both.

## c. Family / care-request time windows

```
care_request_time_windows
  id, care_request_id FK -> care_requests(id) ON DELETE CASCADE,
  agency_id FK, virtual_office_id FK null,
  day_of_week int (0-6) check,
  preferred_start time, preferred_end time,
  earliest_start time, latest_end time,
  min_duration_hours numeric, preferred_duration_hours numeric,
  flexibility text check in ('continuity','balanced','flexible'),
  notes text, is_demo boolean not null default false,
  created_at, updated_at
```

Linked to the Phase A `care_requests`. Added to `purge_demo_data()` **before** `care_requests`
in the delete order.

## d. Flexibility levels (capture only)

New enum-style text constraint `('continuity','balanced','flexible')`:

- caregiver stance → `caregiver_preferences.flexibility` already exists with a text check; reuse it
  and align its allowed values to the three levels.
- family stance → `care_requests.flexibility` (new column) plus optional per-window override.

Capture UI: a plain-language question ("What matters most when we schedule?" → Same caregiver
every time / A good balance / Whoever is available soonest) rendered as a simple select in V1.
Stored and displayed only. **No engine acts on it in this phase.**

## e. Wiring (no new engine)

- **When availability is captured:** post-approval, in the caregiver profile/settings surface
  (`CaregiverSettings` → `AvailabilityDialog`), and by staff from `Caregivers`. It is **not**
  captured during screening today, and applicants have no structured availability.
  Therefore the HR filter in **Caregiver Applications applies to approved caregivers only** —
  in the applications list it stays disabled with a short explanatory note (unchanged from
  Phase A's honest position). The availability filter instead lands on the **Caregivers roster**
  page, where the data actually exists: filter by weekday + time window coverage.
- **2.5 eligibility:** `check_assignment_eligibility` continues reading
  `caregiver_availability` (already structured, never JSON) and gains an additional check
  against `caregiver_availability_exceptions` for the shift date. Existing rows unchanged →
  same outcomes. No JSON read is added or kept anywhere in scheduling.

## f. Security

- New tables: RLS on, `agency_id`-scoped via the existing tenancy pattern; staff (system_admin /
  agency_admin / manager / scheduler / hr_staff) manage in-tenant; caregivers select+write their
  own rows only (`caregiver_id IN (select my_caregiver_ids())`); no anon grant, no anon policy.
  GRANTs: `authenticated` CRUD, `service_role` ALL.
- **Phase A carry-over check — PASS.** The `caregiver_registrations` staff UPDATE policy is
  agency-scoped: staff must match `agency_id IN (select agency_id from profiles where id = auth.uid())`,
  with only `system_admin` bypassing and `agency_id IS NULL` (legacy unscoped) rows shared.
  Staff cannot edit another agency's registrations.

## g. Additive change list

New tables: `caregiver_availability_exceptions`, `care_request_time_windows`.
New columns: `caregiver_availability` (+agency_id, preferred_start/end, earliest_start,
latest_end, flexibility_minutes); `care_requests` (+flexibility).
FKs: caregiver, agency, care_request, virtual_office. Constraints: dow range, time ordering,
flexibility check, unique (caregiver_id, exception_date).
Everything is additive. The only behaviour change is the new date-exception hard/soft check in
eligibility (a genuinely new rule, zero rows exist so current outcomes are unchanged) and the
JSON columns no longer being written. Existing scheduling outcomes for existing data are
identical — proven by re-running eligibility before/after migration for the 3 existing rows.
