# ITEM 5 — HOURS DELIVERED (assigned vs actual utilization) — STEP 1: INSPECT & PROPOSE

Nothing built yet. Hours only — no rates, no dollars, no earnings, no payroll anywhere.

## a. Data sources (verified against live data)

**Assigned hours**
- Source: `shifts` joined to `shift_assignments` (2B source of truth for who works a shift).
- Duration: `shifts.duration_hours` — NOT NULL and populated on every row (0 nulls today), so no
  start/end arithmetic needed. Start/end times are only used for the "has it occurred yet" cut.
- Cancelled excluded two ways: `shifts.status <> 'cancelled'` AND
  `shift_assignments.status NOT IN ('cancelled')`. (Note: there are currently 0 cancelled shifts,
  so this filter is untestable with real data today — it will be unit-verified with a temporary
  row that is rolled back.)
- Per caregiver: `shift_assignments.caregiver_id`.

**Actual hours**
- Source: `time_entries.hours_worked`, per `time_entries.caregiver_id`.
- Period filter: `started_at` (the executed clock-in moment) — the fact of when work happened.
  Not the shift date, so a shift worked past midnight lands in the day it started.
- Status filter: `status = 'approved'` and `voided_at IS NULL`. Draft/rejected/voided time is not
  delivered hours. All 23 existing entries are approved.

**VO attribution (the known gap)** — `shifts` has no `virtual_office_id`. Proposal: attribute by
**caregiver** (`caregivers.virtual_office_id`), not by client. Reasons: this view is a caregiver
utilization view, both sides (assigned and actual) key off caregiver, and attributing by client
would split one caregiver's row across offices and make the per-caregiver breakdown incoherent.
Coverage today: 8 of 9 caregivers have a VO; 1 does not and will be grouped under
"Unassigned office" rather than hidden. No schema change requested — flagging that if you later
want client-based (site-of-service) attribution, that needs `shifts.virtual_office_id`.

## b. Period model (retrospective only)

Presets: This week, **Last week (default)**, This month, Last month, Custom range. Default is a
completed period so the first thing shown is meaningful.

The period is always clipped to the past: the effective end is `min(period_end, today)`. Within
that, a shift counts as assigned only when it has **already occurred** —
`shift_date < today` OR (`shift_date = today` AND `end_time <= now()`). Future-dated shifts inside
a selected range are excluded from assigned/gap/ratio entirely and reported separately as
"scheduled ahead" so the number is never a misleading 0%.

## c. Empty / partial states (exact rendering)

| Situation | Renders as |
|---|---|
| Caregiver has assigned hours in period but none occurred yet | Row shows `— not yet worked`, with the scheduled-ahead hours in a muted sub-label; excluded from gap and ratio, and excluded from the VO totals' ratio |
| Period has zero approved time entries | Actual column shows `No actuals yet` (not "0 hours"), gap and ratio show `—` |
| Actual > 0 but assigned = 0 | Row is shown with an "Unassigned actuals" badge and gap `—`, ratio `—`; a footnote counts these rows so they are visible, not silently dropped |
| assigned = 0 and actual = 0 | Caregiver omitted from the breakdown; the count of inactive caregivers is stated below the table |
| Ratio | Displayed only when assigned > 0 AND at least one shift has occurred; otherwise `—` |

Gap is displayed signed: positive = under-delivery (muted red), negative = over-delivery (amber,
worked more than assigned), zero = on target.

## d. Two levels + where it lives

New **"Hours"** tab in the existing `/reports` page (`src/pages/Reports.tsx`), alongside Overview /
Shifts / Workforce / Clients / Performance. No new page, no new route, no new nav module.

- **Top: per-VO summary cards** — for the selected VO (or "All offices"): total assigned, total
  actual, gap, fulfillment ratio, plus a small "not yet worked" figure. When multiple VOs are in
  scope, a VO table row per office as well.
- **Below: per-caregiver breakdown table** — caregiver, office, assigned h, actual h, gap,
  ratio, state badge. Sortable by gap. CSV export reuses the page's existing `exportToCSV`.
- VO filter dropdown (All offices + each VO + Unassigned office) and the period selector live in
  the tab header; the page's existing global date range is not repurposed, so the other tabs are
  untouched.

Implementation: one new component `src/components/reports/HoursDeliveredTab.tsx` + a pure
computation helper `src/lib/hoursDelivered.ts` (so the math is unit-testable). `Reports.tsx`
changes are limited to adding the tab trigger and content.

## e. Audience & security

- Staff/managers: agency-scoped reads on `shifts`, `shift_assignments`, `time_entries`,
  `caregivers`, `virtual_office` — all four already have 2A agency-scoped RLS, and the queries
  additionally pass an explicit `.eq("agency_id", …)` per the project rule. **No new policy needed.**
- Caregiver self-view: **defer**. Existing RLS already restricts caregivers to their own
  `time_entries` and assignments, so it is safe, but the tab is a staff analytics surface and
  surfacing a partial version to caregivers is a separate UX decision. The tab renders only for
  users with reports permission.
- No anon access, no grant changes, no cross-agency reads (every query is agency-filtered and
  RLS-backed).

## f. Confirmations

- **Hours only.** No rate, dollar, `pay_rate`, `earnings_lines`, or payroll reference in any query,
  computation, or label.
- **No new schema.** One flagged limitation: VO attribution is by caregiver because `shifts` has no
  `virtual_office_id` (unchanged, not added).
- **Additive.** Existing Reports tabs, queries, and every other page are unchanged; the only edit to
  an existing file is the added tab in `Reports.tsx`.
- Data reality check: time entries currently span 2025-11-23 → 2025-11-29 only, so the default
  "Last week" will show "no actuals yet" until you pick a range covering that week — expected and
  honestly rendered, not a bug.
