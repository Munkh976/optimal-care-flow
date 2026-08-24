# Item 6 — Event / Analytics Substrate (capture layer only)

Additive. No dashboards, no analytics UI, no LLM. Only: one append-only event log, a logging helper, and non-blocking emission from the existing authoritative server functions.

## a. Event model

New table `public.events`:

- `id uuid pk`
- `agency_id uuid NOT NULL` (tenancy)
- `virtual_office_id uuid NULL`
- `event_type text NOT NULL` + CHECK against the controlled list in (b) (text + CHECK, not a Postgres enum — adding a value later is a one-line ALTER instead of an enum migration)
- `actor_type text NOT NULL` (`staff` | `caregiver` | `client` | `system` | `anon`), `actor_id uuid NULL`
- `subject_type text NOT NULL`, `subject_id uuid NULL`
- `payload jsonb NOT NULL DEFAULT '{}'` — small, structured context only (no PII dumps, no free text bodies)
- `occurred_at timestamptz NOT NULL DEFAULT now()`
- `is_demo boolean NOT NULL DEFAULT false`
- `created_at timestamptz NOT NULL DEFAULT now()`

Indexes:
- `(agency_id, event_type, occurred_at DESC)` — the metric aggregation path
- `(subject_type, subject_id, occurred_at)` — per-shift/per-request timelines (time-to-fill)
- `(agency_id, occurred_at DESC)` — recent activity scans
- partial `(agency_id, occurred_at)` WHERE `is_demo` is false (optional; only if volume warrants — will include it, it is cheap)

Append-only: rows are facts. No UPDATE, no DELETE policies for anyone. Only deletion path is `purge_demo_data()` (SECURITY DEFINER, `is_demo` rows). No `updated_at` column and no update trigger, deliberately.

## b. Event vocabulary (minimal set)

| event_type | subject | enables |
|---|---|---|
| `caregiver_application_received` | registration | applicant funnel denominator |
| `caregiver_approved` | registration | applicant conversion numerator |
| `caregiver_rejected` | registration | rejection rate |
| `care_request_received` | care_request | request→client denominator |
| `care_request_converted_to_client` | care_request | conversion numerator |
| `shift_created` | shift | fill-rate denominator, time-to-fill start |
| `shift_assigned` | shift_assignment | assignment activity, method mix |
| `shift_filled` | shift | fill rate numerator, time-to-fill end |
| `shift_completed` | shift | completion rate base |
| `shift_cancelled` | shift | cancellation rate |
| `caregiver_pickup` | shift | self-serve fill share |
| `assignment_released` | shift_assignment | churn / re-fill |
| `rating_added` | shift_rating | quality trend |
| `time_entry_submitted`, `time_entry_approved` | time_entry | payroll cycle time (item 5) |
| `earnings_computed` | earnings_line | payroll completeness (item 5) |

Not proposed / flagged:
- **`shift_no_show`: cannot fire today.** `shift_status` has no `no_show` value; only `assignment_status` does, and nothing in the app sets it. I will reserve the vocabulary value in the CHECK list but emit nothing until a real no-show action exists. No-show rate is therefore NOT derivable yet — flagged, not faked.
- `shift_assigned` vs `shift_filled`: both emitted from the same call, but kept distinct so a future multi-caregiver shift can be assigned without being fully filled.

## c. Emission strategy

Helper: `public.log_event(_agency_id, _event_type, _actor_type, _actor_id, _subject_type, _subject_id, _payload, _virtual_office_id, _is_demo)` — SECURITY DEFINER, `search_path=public`, wrapped in `BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END;` so a logging failure can never abort the caller. Callers use `PERFORM public.log_event(...)`.

| event | emitted from |
|---|---|
| `caregiver_application_received` | trigger on `caregiver_registrations` INSERT (public form writes directly, no function) |
| `caregiver_approved` / `caregiver_rejected` | trigger on `caregiver_registrations` UPDATE when status leaves `pending` (covers the edge function without giving it a new failure mode) |
| `care_request_received` | trigger on `care_requests` INSERT (covers `flow_session_submit_intake` and staff-created requests in one place) |
| `care_request_converted_to_client` | explicit `PERFORM log_event` inside `convert_care_request_to_client` |
| `shift_created` | trigger on `shifts` INSERT (shifts are created from several paths incl. plan generation) |
| `shift_assigned`, `shift_filled` | explicit inside `assign_caregiver_to_shift` |
| `caregiver_pickup` (+ `shift_filled`) | explicit inside `caregiver_pick_up_shift` |
| `assignment_released` | explicit inside `release_shift_assignments` |
| `shift_completed`, `shift_cancelled` | trigger on `shifts` UPDATE on status transition (status is set by direct updates from the UI) |
| `rating_added` | trigger on `shift_ratings` INSERT |
| `time_entry_submitted` / `_approved` | trigger on `time_entries` status change |
| `earnings_computed` | explicit inside `compute_earnings_for_time_entry` |

Triggers themselves call `log_event`, which swallows its own errors, so a trigger can't break a write either.

`is_demo` on the event is inherited from the subject row where the subject has an `is_demo` column.

## d. Metrics derivability

- Applicant conversion = count(`caregiver_approved`) / count(`caregiver_application_received`)
- Request→client conversion = count(`care_request_converted_to_client`) / count(`care_request_received`)
- Fill rate = count(distinct subject of `shift_filled`) / count(`shift_created`)
- Time-to-fill = `shift_filled.occurred_at − shift_created.occurred_at` joined on `subject_id`
- Cancellation rate = count(`shift_cancelled`) / (`shift_completed` + `shift_cancelled`)
- No-show rate — NOT derivable; no source data exists (see b)
- Self-serve fill share = `caregiver_pickup` / `shift_filled`
- Re-fill churn = `assignment_released` per shift

## e. Security

- RLS enabled. `SELECT`: `system_admin` (all) and agency staff for their own `agency_id`. Caregivers and clients get no read policy.
- No INSERT/UPDATE/DELETE policy for anyone — writes happen only through SECURITY DEFINER `log_event`, which bypasses RLS. A caregiver or client calling `insert into events` is refused.
- Grants: `GRANT SELECT ON public.events TO authenticated;` `GRANT ALL ... TO service_role;` **no `anon` grant at all** — anon can neither read nor write. I'll re-verify with a grant audit query after the migration.

## f. Scope confirmation

Additive only. Changes:
1. New table `public.events` + indexes + RLS + grants.
2. New `public.log_event(...)` helper.
3. New triggers on: `caregiver_registrations`, `care_requests`, `shifts`, `shift_ratings`, `time_entries`.
4. `PERFORM log_event` lines added to `assign_caregiver_to_shift`, `caregiver_pick_up_shift`, `release_shift_assignments`, `convert_care_request_to_client`, `compute_earnings_for_time_entry`.
5. `purge_demo_data()` / dry-run extended to delete `events WHERE is_demo` (first in the order — nothing references it).

No changes to 2A RLS on existing tables, 2B triggers, 2.5 eligibility, anon grants, the public page, or Phase A–D behavior. Existing function return values, signatures, and business logic are unchanged; the only addition is a non-blocking `PERFORM log_event`. No backfill — capture is forward-only.

## Verification after build

Perform each action live (assign, pick-up, release, convert request, approve/reject caregiver, complete/cancel shift, add rating, submit intake) and confirm exactly one correct event row each; force a log failure and confirm the operation still succeeds; confirm caregiver/client direct INSERT is refused; confirm anon has zero grants; confirm cross-agency events are invisible.
