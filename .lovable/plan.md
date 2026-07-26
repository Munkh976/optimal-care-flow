## What I understand

1. **Order creation should not force picking a caregiver.** Today the Create Order wizard (Step 3) requires selecting a caregiver available on the chosen weekday before you can pick a time or continue. Orders are created by the agency admin/manager, so they should be able to generate the shifts *unassigned* and let scheduling happen later (Quick Assign / Schedule).
2. **Assignment needs a proper confirmation step.** Instead of a bare "Assign" button, managers should get a drawer/modal where they confirm caregiver, care type, and start/end time before the assignment is saved.
3. **Quick Assign workflow needs review** — it currently writes to two places and can drift out of sync.

## Bugs found while reviewing

- Order shift creation writes `agency_id: user.id` (the user's auth id) instead of `profile.agency_id` — wrong tenant value on every shift created from an order.
- Shifts created with a caregiver still get `status: 'open'`, so they show as unassigned in Schedule but have a `caregiver_id`.
- Order creation writes `shifts.caregiver_id` directly but never creates a `shift_assignments` row, while Quick Assign creates both — two inconsistent representations of "assigned".
- After saving an order, the list refresh uses `fetchOrders(user.id)` instead of the agency id, so the table doesn't refresh correctly.
- Time slots are label-only ("6:00 evening" → 18:00 via a hand-rolled AM/PM parse); end time is `start + duration` with no explicit control and can silently roll past midnight.

## Plan

### 1. New `AssignShiftDialog` component (`src/components/schedule/AssignShiftDialog.tsx`)
A single reusable confirmation modal used by Quick Assign, the Shifts list view, and the shift details dialog:
- Shows client, date and location as read-only context.
- **Caregiver** — preselected (from the AI match or the row action) but changeable via a searchable select of active agency caregivers; shows match score / rating when available.
- **Care type** — select, defaulted from the shift.
- **Start / end time** — time inputs defaulted from the shift, with live duration calculation and validation (end after start, duration > 0).
- Optional note field.
- Conflict check on confirm: warns if the caregiver already has an overlapping shift that day, and if there is an approved time-off request covering the date.
- On confirm: single write path — update the shift (`caregiver_id`, `care_type_code`, `start_time`, `end_time`, `duration_hours`, `status: 'assigned'`) and upsert one `shift_assignments` row.

### 2. Centralise assignment logic
Add `src/lib/shiftAssignment.ts` with `assignShift()` used by every caller so shift + assignment rows never diverge. Quick Assign's inline insert/update is replaced by this.

### 3. Quick Assign workflow fixes
- "Assign" opens the new dialog instead of writing immediately.
- Preserve the AI match score / factors in the dialog as decision context.
- Keep the `?shift=` deep link working from Schedule and the shift details dialog.

### 4. Order Management: caregiver becomes optional
- Step 3 renamed "Schedule" — day, time and recurrence only; caregiver moves to an optional "Assign a caregiver now (optional)" section that stays collapsed by default with a clear "Leave unassigned — assign later from Schedule" default.
- Available-caregiver lookup still runs on weekday selection, but only when the manager opens that optional section, and it never blocks the Next button.
- Time selection no longer requires a caregiver.
- Explicit **Start time** and **End time** controls (defaulted from the service duration) replace the AM/PM slot-string parsing, so the saved times are unambiguous.
- Step 4 review shows "Unassigned — will appear in Quick Assign" when no caregiver is chosen.
- Shift insert fixed: correct `agency_id` from the profile, `status` = `'assigned'` only when a caregiver is chosen (otherwise `'open'`), and a matching `shift_assignments` row created when a caregiver is chosen.
- Post-save refresh uses `profile.agency_id`.

### 5. Entry points
Wire the new dialog into the Shifts list view "Assign" button and the Quick Assign button in `ShiftDetailsDialog` so managers get the same confirmation everywhere.

CSV batch order import is out of scope for this change, as you noted — I'll leave the order-creation code structured so it can feed the same shift-generation helper later.
