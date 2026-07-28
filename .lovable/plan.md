## What's wrong today (verified)

- **Labels**: the caregiver form still says "Care Types / Skills" (`Caregivers.tsx` line 619) and the table/detail panes say "Care Types" / "Care Types & Skills". The rest of the app was renamed to "Care Services".
- **Categories look different**: they are actually in sync — `care_types.category` stores the full category name and matches `care_service_categories`. What differs is presentation: the skills dropdown renders `Service Name (Full Category Name)`, so it looks unlike the Care Services list which shows a short category badge. Only 4 of the 6 categories currently have any services, so the skills list looks shorter than the category list.

---

## Phase 1 — Naming and skills UX (small, do first)

- Rename in `Caregivers.tsx` and `CaregiverProfileSettings.tsx`: "Care Types / Skills" → **Care Services / Skills**, "Care Types" column → **Care Services**, detail header → **Care Services & Skills**.
- Group the skills multi-select by category (section headers) instead of appending the category in parentheses, and show the service **code** as a muted suffix — matching the Care Services table.
- Show inactive services as disabled/hidden so caregivers can't hold skills for retired services.

---

## Phase 2 — Time Off (foundation for trades)

Approve/deny with manager note; on approval, detect assigned shifts inside the range and offer: release to Unassigned, or push to the Trade Board. Overlap validation, `pending_notifications` entry to the caregiver. Nothing else in scheduling is trustworthy until approved absence releases shifts.

---

## Phase 3 — Shift Trades with an eligibility engine

Yes to your model: **if a caregiver meets every hard rule, the trade auto-approves without a manager.** Manager review is only for exceptions.

### Hard rules (block the pickup entirely)
1. **Skill match** — the taker must hold the shift's `care_type_code` in `caregiver_skills` (and any `required_skills` on the shift).
2. **Certification valid** — no cert required by the service is expired on the shift date.
3. **Double-booking** — no overlapping assigned shift (plus a configurable travel buffer, default 30 min).
4. **Weekly hours cap** — assigned hours for that caregiver's week (Mon–Sun) + this shift must not exceed **40h**; over the agency `overtime_threshold` it is blocked outright for self-serve.
5. **Approved time off / availability** — the shift must fall inside the caregiver's declared availability and outside approved time off.
6. **Active status** — caregiver must be active and not in a pending/rejected registration state.
7. **Service area** — shift ZIP within the caregiver's `service_zipcodes` / radius.

### Cases that require manager approval (soft flags → routes to review instead of blocking)
- Overtime between the agency threshold and 40h, or any hours push for a part-time caregiver below/above `custom_min_hours`.
- Pay-rate delta: the taker's `hourly_rate` is materially higher than the original (cost impact), or the trade carries surge pay.
- **Client-preferred caregiver** shift, or a client with a locked/continuity-of-care assignment.
- Shift starts within **24 hours** (late trade) or is already `in_progress`.
- Specialized-care services (e.g. hospice, dementia, medication management) — configurable per care service via a new `requires_approval` flag.
- Caregiver reliability score below threshold, or 2+ no-shows in the last 30 days.
- Trade would leave the giver below their contracted minimum hours.

### Manager powers (always)
Agency admins/managers can **reassign any caregiver on any shift at any time**, overriding soft flags with a recorded reason. Hard conflicts (double-booking, expired cert) still show a blocking confirmation with an explicit override checkbox, and every override is logged.

### UI
- **Trade Board** tab in the Schedule workspace: open offers, filters (date, service, distance, pay), "Pick up" button that runs the eligibility engine live and shows exactly why it's blocked or flagged.
- Caregiver side: "Give up shift" from My Shifts → posts to board (or direct-offer to one colleague).
- Manager side: "Trades needing approval" queue on the dashboard.

---

## Phase 4 — Caregiver performance metrics (DoorDash-style)

Tracked per caregiver, rolling 30-day + lifetime, computed from `shift_assignments`:

| Metric | Definition | Use |
|---|---|---|
| Completion rate | completed ÷ (completed + no_show + late-cancel) | hard gate below ~85% |
| On-time rate | clock-in ≤ 5 min after start | smart-match ranking |
| Acceptance rate | offers accepted ÷ offers sent | ranking + trade eligibility |
| Reliability score | composite of the three above, 0–100 | already a column; make it computed |
| Client rating | 1–5 post-shift rating (new `shift_ratings` table) | ranking, client preference |
| Shifts last 30d / lifetime | volume | tenure weighting, tie-break |
| Avg hours/week & OT exposure | rolling | cap enforcement |
| Cancellation lead time | avg hours notice | flag chronic late cancels |
| Continuity | % of shifts with repeat clients | client-satisfaction proxy |
| Travel distance | ZIP distance | cost + punctuality prediction |

Smart-assign score = weighted blend (skill match 30, availability/conflict 25, reliability 15, client history/continuity 10, rating 10, distance 5, cost/OT 5), with the weights stored in agency settings so you can tune them.

---

## Phase 5 — Reports redesign

Four tabs, all agency-scoped, all with date-range + CSV export:

1. **Operations** — coverage rate (filled ÷ total), time-to-fill, unfilled-shift trend, fill method split (manual / smart / auto / trade), same-day cancellations.
2. **Workforce** — hours by caregiver, overtime exposure vs threshold, utilization vs availability, no-show/late leaderboard, cert-expiry pipeline, headcount by employment type.
3. **Clients & Service** — service mix by care service and category, hours per client, order fulfilment %, client rating trend, churn/inactivity signals.
4. **Financial** — billable hours × service price vs caregiver cost, margin by service and by client, OT cost, surge/trade premiums.

Each tab leads with 3–4 KPI cards with period-over-period deltas, then one trend chart, then a drillable table. Every number links back into Schedule/Caregivers filtered to those rows. This stays separate from the System Admin platform analytics.

---

## Technical notes

- New DB objects: `shift_ratings`, `caregiver_metrics` (materialized/rollup refreshed nightly + on shift completion), `care_types.requires_trade_approval`, `shift_trades` gains `eligibility_snapshot jsonb` and `auto_approved boolean`, agency-level `smart_match_weights jsonb`.
- Eligibility engine lives in a single shared module (`src/lib/shiftEligibility.ts`) used by the trade board, Assign Shift dialog, and Smart Assign sheet — plus mirrored in a Postgres function so the rules can't be bypassed from the client.
- All trade state changes go through an edge function so hours caps and double-booking are checked server-side atomically.

## Suggested order

Phase 1 (quick) → Phase 2 → Phase 3 → Phase 4 → Phase 5. Phases 4 and 5 depend on the assignment data model settling in 2–3.
