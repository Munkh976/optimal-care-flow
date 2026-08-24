# Phase 4 — Performance consolidation: one source of truth for ratings

## a. What `caregiver_performance` computes today

It is a view, `security_invoker = true` (so 2A RLS on `caregivers`, `shift_assignments`, `shifts`, `shift_ratings` applies to the caller — no cross-tenant leak). Granted to `authenticated` and `service_role` only, no `anon`.

Columns per caregiver: `caregiver_id`, `agency_id`, `lifetime_completed`, `lifetime_no_shows`, `shifts_last_30d`, `hours_last_30d`, `lifetime_hours`, `completion_rate`, `on_time_rate`, `avg_rating` (= `ROUND(AVG(shift_ratings.rating),2)`, NULL when unrated), `rating_count`.

So yes — it already produces the authoritative rating: `avg_rating` + `rating_count`. No new engine needed. One gap: it has no "recent window" rating. Proposal: add `avg_rating_90d` / `rating_count_90d` (ratings joined to shift date) so the profile can show recent vs lifetime.

Current data: 25 ratings across 6 caregivers; 8 caregivers carry a stored `performance_rating`. The two disagree today.

## b. Retiring `caregivers.performance_rating`

Recommendation: **option (ii) — stop reading it entirely**, matching the 2B `shifts.caregiver_id` discipline but stricter (2B needed a trigger because legacy queries filtered on it; nothing here needs a stored column). A trigger-sync would keep a second copy that can drift on every unrated caregiver and on rating deletes.

Actions:
- Repoint every read to `caregiver_performance`.
- Comment the column as deprecated/derived and stop selecting it in app code.
- Manual edit surfaces: I checked — the staff Caregivers page has **no** input for `performance_rating`; it is only set by seed/demo data. So nothing to remove in the UI. To make hand-setting impossible as truth, add a trigger that refuses client-side changes to the column (keeps it frozen), rather than dropping it (drop would break the `get_caregiver_with_profile` function and MCP tool contracts).
- The MCP `list-caregivers` tool and `match-caregiver` edge function also read it — both get repointed to the computed rating (see c).

## c. Repointing consumers

| Consumer | Change |
|---|---|
| `AssignShiftDialog` | Load ratings from `caregiver_performance`; show `★ 4.6 (12)` or `no ratings` |
| `CaregiverGridView` | Same badge, unrated shows nothing/`no ratings` |
| `CaregiverDashboard` | Own performance card reads the view (own row only, via RLS) |
| `SmartAssignSheet` | Displays computed rating + count; ranking uses computed rating |
| `match-caregiver` edge fn | Prompt receives `avg_rating (n ratings)` or `not yet rated`, never a fake 5.0 |
| `client-dashboard/CareTeam`, `OrdersManagement`, `MySchedule` | Also read the stored column; repointed for consistency |

Unrated handling: unrated caregivers are never treated as 0. They are ranked on the other factors (skills, availability, proximity, hours) with the rating factor **omitted** — i.e. neutral, not penalised — and labelled `New — no ratings yet`. The UI shows `—`, never `0.0` stars.

## d. Transparent performance profile

Real, backed by data today:
- Average rating + rating count (lifetime, plus new 90-day window)
- Completion rate, lifetime completed count
- On-time rate (from `clock_in_time` vs shift start — 23 assignments have clock-ins)
- Activity: shifts and hours in last 30 days vs lifetime

Not reliably available: **no-show and cancellation rates**. The column exists (`lifetime_no_shows`) but there are currently **0 no-show and 0 cancelled assignments** recorded, so the metric renders as "not enough data" rather than a flattering 100%. No invented metrics.

Surfaced as a small reusable `PerformanceProfile` block (used on caregiver detail and the caregiver's own dashboard) showing the pieces, not one opaque score.

## e. Security

- View is `security_invoker` → caregiver sees own row, staff see own agency, cross-agency denied by the underlying 2A policies. No `anon` grant. Verified at implementation time with actual signed-in/cross-agency queries.
- The added 90-day columns reuse the same base tables — no policy change needed.

## f. Scope

Additive/consolidation only. Changes: one migration (add 90-day rating columns to the view + freeze-trigger and deprecation comment on `performance_rating`), plus read-path edits in the components listed above and the two backend readers. `Reports.tsx` already aggregates `shift_ratings` directly and is untouched — the performance tab keeps working unchanged. No eligibility, RLS, trigger (2B), or public-page changes.

## Test plan (actual, reported with results)
1. A caregiver's displayed rating equals `AVG(shift_ratings)`, not the old stored value.
2. Insert a rating → displayed and ranked value moves; roll back.
3. Unrated caregiver shows "no ratings" and still ranks on other factors.
4. Attempt to hand-set `performance_rating` → rejected.
5. Caregiver sees own performance; staff see own agency; cross-agency returns nothing.
6. Reports performance tab output unchanged before/after.
