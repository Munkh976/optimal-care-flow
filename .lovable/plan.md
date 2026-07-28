## Assessment of what exists today

The current order flow is internally inconsistent:

- The wizard lets you pick a **Primary Care Service + one optional additional service**, but the additional service is never scheduled — it is dumped into `special_notes` as text. It creates no shifts, no hours, no billing trace.
- The schedule step allows **exactly one weekday and one time slot**, yet the recurrence selector offers One Time / Weekly / Bi-Weekly / Monthly. Bi-weekly and monthly are not actually honored: generation loops every day and matches `d.getDay() === day`, so bi-weekly produces *weekly* shifts and monthly produces *weekly* shifts for 12 months.
- Order length is **implied by the frequency** (weekly → 3 months, biweekly → 6, monthly → 12). The customer never chooses a duration.
- The order row stores `frequency` and `days_of_week` (text), but `days_of_week` is never written — the real schedule only survives as generated shift rows, so an order cannot be meaningfully edited or re-generated.

So: the data model is a single-slot booking wearing an "order" label, and it cannot express your requirement.

## Should orders exist at all?

Keep them. Most competing platforms do have an authorization/care-plan layer above shifts — they just don't call it an "order". Shift-only entry breaks down as soon as you need "this client is authorized for 20h/week of personal care through March", recurring regeneration, per-client service history, and later billing/invoicing. The fix is not to delete orders, it is to make the order a **Care Plan with service lines** and keep shifts as the generated, assignable execution records.

```text
Client
  └── Order (care plan)         start date, duration, status
        ├── Service line 1      service, days [Mon,Wed,Fri], 09:00-13:00, weekly
        ├── Service line 2      service, days [Tue], 14:00-16:00, biweekly
        └── Service line 3      service, days [Mon], 18:00-20:00, weekly
              └── generates → Shifts (one row per date) → Assignments
```

This directly satisfies both requirements: same service across all or selected weekdays for 1/2/3/6/12 months, and two or more services on different days *or different times on the same day* (each is its own line).

## Target architecture

**Database**

1. New table `order_services` (the service lines):
   - `order_id`, `care_type_code`, `days_of_week` (int array 0–6), `start_time`, `end_time`, `duration_hours` (generated), `frequency` (`once` | `weekly` | `biweekly` | `monthly`), `week_of_month` (for monthly), `notes`, `is_active`.
   - GRANTs + RLS scoped by the parent order's `agency_id`, matching existing order policies.
2. `client_orders`: add `duration_months` (1, 2, 3, 6, 12, or custom end date) and keep `end_date` as the derived stop point. `frequency`/`days_of_week` on the order become legacy/summary only.
3. `shifts`: add `order_service_id` so every generated shift traces back to its line — enables safe regeneration ("replace future shifts of this line" without touching completed ones).
4. Backfill: existing orders get one `order_services` row reconstructed from their shifts; existing shifts get linked.

**Generation logic** (new `src/lib/orderScheduling.ts`, pure and unit-testable)

- Input: order start date, duration months, list of service lines. Output: shift rows.
- `weekly` → every matching weekday. `biweekly` → matching weekdays on alternating weeks anchored to the start date. `monthly` → matching weekday of the Nth week of each month. `once` → first matching date only.
- Overlap detection across lines for the same client (same date, overlapping times) surfaced as a warning before save.
- Preview: the wizard shows total shifts, total hours, hours/week, and the first ~10 dates before anything is written.

**Order Management UI rebuild**

- Step 1 — Client.
- Step 2 — Service lines. Add as many lines as needed; each line = service picker (grouped by managed categories via `useCareServices`), weekday multi-select chips (with "All days" / "Weekdays" / "Weekends" shortcuts), start/end time, frequency. Lines are addable, editable, removable.
- Step 3 — Duration. Start date + duration (1, 2, 3, 6, 12 months, or explicit end date).
- Step 4 — Review. Per-line summary, generated-shift preview, conflict warnings, then Save draft / Submit.
- Caregiver selection stays out of the wizard — shifts are created unassigned and filled from Schedule (this matches what we already agreed).
- **Edit order**: same wizard, pre-filled. Saving regenerates only future, unassigned/open shifts for changed lines; past and completed shifts are preserved untouched. Removing a line cancels its future shifts.
- Order list rows show the line summary ("Personal Care · Mon/Wed/Fri 9–1 · weekly" + "+2 services") instead of a single service name. The existing Active/Completed/Archived tabs and archive behavior stay as they are.

## Technical notes

- Generation happens client-side in `orderScheduling.ts` and writes a single batched `shifts` insert, same as today — no edge function needed.
- 12 months × 5 days/week ≈ 260 shifts per line; batched insert handles this, and the preview warns above ~500 total shifts.
- `duration_hours` per shift comes from the line's times, so Reports/hours math keeps working unchanged.
- `useCareServices` remains the single source for the service catalog and category ordering.
- Schedule, Reports, and the client portal read shifts, so they need no changes beyond the optional new `order_service_id` column.

## Build order

1. Migration: `order_services`, `client_orders.duration_months`, `shifts.order_service_id`, GRANTs/RLS, backfill.
2. `src/lib/orderScheduling.ts` + tests for weekly/biweekly/monthly/once and overlap detection.
3. New wizard components (`OrderServiceLineEditor`, `OrderSchedulePreview`) and rebuilt create/edit flow in `OrderManagement.tsx`.
4. Order list/detail updates for multi-line display.
