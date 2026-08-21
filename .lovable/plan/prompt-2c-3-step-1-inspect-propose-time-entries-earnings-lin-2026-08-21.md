# PROMPT 2C-3 — STEP 1: INSPECT & PROPOSE (time_entries + earnings_lines)

Nothing was created or changed. This is the written model, awaiting approval.

## A. Inspection — existing time data on `shift_assignments`

Time/tracking columns that exist today:

| column | type | populated (of 28 rows) |
|---|---|---|
| `clock_in_time` | timestamptz | 23 |
| `clock_out_time` | timestamptz | 23 |
| `actual_hours_worked` | numeric | 23 |
| `mileage` | numeric | 0 |
| `status` | assignment_status enum | 28 (23 = `completed`) |
| `notes` | text | — |
| `is_demo` | boolean | 28 = true |

There is **no break column** and **no timeclock write path in the app today**. Every reference
in the frontend is read-only display:
- `src/pages/Reports.tsx` (punctuality: compares `clock_in_time` to scheduled start)
- `src/pages/CaregiverDashboard.tsx`, `src/components/caregivers/ShiftList.tsx`,
  `src/components/schedule/LiveOpsView.tsx` (display "Clocked in/out at …")

So the columns are currently a **display-only snapshot**, populated by seed data, with no
uncontrolled writer competing for truth.

### Source-of-truth decision — RECOMMENDED: model (i), "authoritative table + derived summary"

Recommendation: **create `time_entries` as the authoritative record of hours worked**, backfilled
from the 23 assignments that have clock data, and **demote the assignment clock/hours columns to
derived**, kept in sync by an anti-drift trigger — exactly the 2B pattern used for
`shifts.caregiver_id`.

Justification:
- Model (ii) (assignment stays the capture point) cannot express corrections, split shifts, or
  unpaid breaks without adding more ad-hoc columns; and earnings must be auditable line-by-line.
- Model (i) gives one writer (the time entry) and keeps the four existing read sites working
  unchanged, because the assignment columns keep being populated — by trigger instead of by seed.
- Relationship: **`shift_assignments` 1 : many `time_entries`** (segments). "Total hours for the
  assignment" is unambiguously
  `sum(hours_worked) WHERE status IN ('submitted','approved') AND voided_at IS NULL`
  — computed by trigger into `shift_assignments.actual_hours_worked`, with
  `clock_in_time = min(started_at)` and `clock_out_time = max(ended_at)` over the same set.
  A `draft` entry never affects the derived columns and never earns.

### Proposed `time_entries`

| column | notes |
|---|---|
| `id` uuid PK | |
| `agency_id` uuid NOT NULL FK → agency | tenancy |
| `shift_assignment_id` uuid NOT NULL FK → shift_assignments ON DELETE CASCADE | authoritative link |
| `shift_id` uuid NOT NULL FK → shifts | denormalized for reporting, enforced by trigger to match the assignment |
| `caregiver_id` uuid NOT NULL FK → caregivers | enforced to match assignment's caregiver |
| `started_at` / `ended_at` timestamptz NOT NULL | CHECK `ended_at > started_at` |
| `break_minutes` integer NOT NULL default 0 | CHECK `>= 0` |
| `hours_worked` numeric(6,2) NOT NULL | CHECK `> 0`; = (ended-started)/3600 − break, set server-side |
| `mileage` numeric(8,2) NULL | CHECK `>= 0` |
| `status` enum `time_entry_status` (`draft`,`submitted`,`approved`,`rejected`) NOT NULL default `draft` | |
| `source` enum `time_entry_source` (`clock`,`manual`,`correction`,`import`) NOT NULL default `manual` | |
| `approved_by` uuid NULL FK → auth.users, `approved_at` timestamptz NULL | |
| `voided_at` timestamptz NULL, `notes` text | corrections without deletion |
| `is_demo` boolean NOT NULL default false | |
| `created_by`, `created_at`, `updated_at` | |

Indexes: `(shift_assignment_id)`, `(caregiver_id, started_at)`, `(agency_id, status)`.
No unique constraint on assignment (1:many by design); overlapping segments within one
assignment are rejected by a trigger.

**Backfill:** 23 time_entries from the 23 assignments with clock data
(`source='import'`, `status='approved'`, `is_demo=true` inherited — **23 demo rows**).
The 5 assignments without clock data get no entry.

**Compatibility impact of the demotion:** none visible. The four read sites keep reading
`clock_in_time` / `clock_out_time` / `actual_hours_worked`; those columns keep their exact
current values after backfill (the trigger reproduces them). What changes is only that they
become *derived*: writes to them from clients get overwritten/blocked by the sync trigger, and
the app has no such writer today. Reports punctuality logic is unaffected.

## B. `earnings_lines`

Rate fields that exist: `shifts.pay_rate` (numeric, populated on 41 of 156 shifts) and
`caregivers.hourly_rate` (populated on all 8 caregivers, 20–32).

**Rate resolution order (proposed):**
1. `shifts.pay_rate` when NOT NULL and > 0 → `rate_source = 'shift'`
2. else `caregivers.hourly_rate` when NOT NULL and > 0 → `rate_source = 'caregiver'`
3. else **no line is created** — the calculation function skips the entry and returns it in a
   `skipped[]` array with reason `missing_rate`. Never computes $0 silently.

**Overtime:** the only overtime data that exists is `profiles.overtime_threshold` (40) — a
per-user setting with no multiplier, no defined week boundary, no agency-level rule. That is not
a usable rule, so I propose **straight hours × rate** only, with an explicit extension point:
columns `overtime_hours numeric NOT NULL default 0`, `overtime_rate numeric NULL`,
`overtime_amount numeric NOT NULL default 0`, and `gross_amount = regular_amount + overtime_amount`.
Today overtime fields are always 0 and `regular_hours = hours_used`. No overtime rules are invented.

| column | notes |
|---|---|
| `id` uuid PK | |
| `agency_id` uuid NOT NULL FK → agency | |
| `time_entry_id` uuid NOT NULL FK → time_entries ON DELETE CASCADE | **UNIQUE** (one live line per entry) |
| `shift_assignment_id`, `shift_id`, `caregiver_id` | NOT NULL FKs, denormalized for reporting |
| `hours_used` numeric(6,2) NOT NULL | copied from the entry at compute time |
| `rate_used` numeric(8,2) NOT NULL CHECK > 0 | |
| `rate_source` enum `earnings_rate_source` (`shift`,`caregiver`) NOT NULL | |
| `regular_hours`, `overtime_hours`, `overtime_rate`, `regular_amount`, `overtime_amount`, `gross_amount` | gross = regular + overtime |
| `status` enum `earnings_line_status` (`calculated`,`voided`) NOT NULL default `calculated` | |
| `computed_at` timestamptz NOT NULL default now(), `computed_by` uuid | audit |
| `is_demo` boolean NOT NULL default false | inherited from the time entry |

**Generated-and-stored, with a recompute path** (recommended for auditability): recompute voids
and replaces the line, preserving `computed_at`/`computed_by` history in the new row.

## C. Calculation path (server-authoritative, 2.5 style)

- `compute_earnings_for_time_entry(_time_entry_id uuid, _recompute boolean default false) returns jsonb`
  — SECURITY DEFINER, `search_path = public`. Refuses unless caller is `is_agency_staff()` in the
  entry's agency (or `system_admin`); refuses unless the entry is `status='approved'` and not
  voided; resolves the rate per the order above; skips with a reason on missing rate; inserts (or
  voids-and-replaces on recompute) the line. Returns `{ ok, earnings_line_id, hours, rate, rate_source, gross, skipped_reason }`.
- `compute_earnings_batch(_agency_id uuid, _from date, _to date, _recompute boolean default false) returns jsonb`
  — loops approved entries in range, returns `{ created, recomputed, skipped: [...] }`.

**RLS / lockdown**
- `time_entries`: caregiver SELECT own rows; caregiver INSERT/UPDATE own rows only while
  `status='draft'` (self clock-in later) — approval columns protected by trigger; staff full
  manage in-tenant; system_admin all; no anon.
- `earnings_lines`: caregiver SELECT own only. **No INSERT/UPDATE/DELETE policy for anyone** —
  writes come exclusively from the definer functions. Grants: `SELECT` to `authenticated`,
  `ALL` to `service_role`; **no INSERT/UPDATE/DELETE grant to `authenticated` or `anon`** on
  `earnings_lines`. `EXECUTE` on both functions granted to `authenticated` only (the functions
  themselves enforce staff-only).

## D. Cross-cutting

- `is_demo` on both new tables. Backfill: **23 demo time_entries**; earnings_lines computed only
  in the rolled-back test (none committed).
- **Purge order** — `purge_demo_data()` / `_dry_run()` extended so the new deletes run *first*,
  before `shift_assignments`:
  `earnings_lines → time_entries → shift_trades → shift_ratings → shift_assignments → shifts → …`
  (existing order below that untouched; the completed-assignment guard logic untouched).
- Constraints summary: FKs listed above; NOT NULLs as marked; 3 new enums
  (`time_entry_status`, `time_entry_source`, `earnings_rate_source`, plus `earnings_line_status`);
  UNIQUE on `earnings_lines.time_entry_id` (partial, where `status='calculated'`);
  CHECKs on times, hours, break, mileage, rate.
- No existing-table data meaning changes except the documented demotion of
  `shift_assignments.clock_in_time`, `clock_out_time`, `actual_hours_worked` to derived — values
  preserved, all four read sites unaffected. 2A RLS, 2B triggers, and 2.5 eligibility functions
  are not touched.

**STOP — awaiting approval before Step 2.**
