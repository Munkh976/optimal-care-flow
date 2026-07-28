# Consolidating scheduling into one workspace

## My analysis

Today four separate menu items all operate on the same object — a shift:

| Page | What it really is | Overlap |
|---|---|---|
| Schedule Management | Plan/view shifts (Shifts, Unassigned, By Caregiver, By Client) | base |
| Quick Assign | Pick one open shift → AI-ranked caregivers → assign | 100% a *fill* action on an unassigned shift |
| Auto Schedule | Batch-fill all open shifts for a week | same fill action, bulk |
| Live Operations | Today's shifts, clock-in/out, late/no-show, realtime | *different time horizon* (now), same object |

Quick Assign and Auto Schedule are not destinations — they are **actions on unassigned shifts**, single vs. bulk. Keeping them as menu items forces managers to leave context, lose their date range and filters, and re-select a shift they were already looking at.

Live Operations is genuinely different in intent (monitoring, not planning) but shares the data model. Industry tools (Wellsky, AlayaCare, Connecteam) put it as a **"Today / Live" view inside the schedule workspace**, not a separate app area.

### Recommendation
- **Merge** Quick Assign and Auto Schedule into Schedule → they become the Unassigned tab's single-row action and a bulk "Auto-fill" button.
- **Merge** Live Operations as a **"Today (Live)" tab** in the same workspace — keep realtime, keep the ops stat strip.
- Keep old routes alive as redirects so bookmarks and RBAC don't break.

Net: 4 menu items → 1 ("Schedule"), 5 tabs.

## Target UX

```text
Schedule Management                       [Day|Week|Month]  < Today >
Filters: search | care category | status | caregiver
──────────────────────────────────────────────────────────────────
[ Today (Live) ] [ Shifts ] [ Unassigned (7) ] [ By Caregiver ] [ By Client ]
```

- **Today (Live)** — stat strip (active / upcoming / late / gaps), realtime shift cards with clock-in state, client phone/address, "Find cover" action that jumps to the assign drawer.
- **Unassigned** — red-badged list. Per row: `Assign` (manual drawer) and `Smart Assign` (AI-ranked caregiver panel, formerly Quick Assign). Header: `Auto-fill range` (formerly Auto Schedule) → runs matching across all rows, shows a preview table of proposed pairings with scores, manager confirms/deselects, then commits.
- **Shifts / By Caregiver / By Client** — unchanged, plus `+ Assign Shift` already present on caregiver cards.
- Smart Assign renders as a **side sheet** over the list, not a page — the manager never loses the range/filters.
- All writes stay on the single `assignShift()` path in `src/lib/shiftAssignment.ts`.

## System / data-flow architecture

```text
client_orders ──generates──> shifts (status: open)
                                │
        ┌───────────────────────┼─────────────────────────┐
   manual assign          smart assign               auto-fill
   (AssignShiftDialog)  (match-caregiver fn)   (loop match-caregiver)
        └───────────────────────┼─────────────────────────┘
                                ▼
                    assignShift()  [single write path]
                shifts.caregiver_id + status='assigned'
                shift_assignments row (method: manual|ai_suggested|auto_assigned)
                                │
                     ▼ day arrives ▼
             Today (Live): clock_in_time / clock_out_time
                → status in_progress → completed
                                │
                     exceptions → shift_trades / re-open
```

Single source of truth stays `shifts` + `shift_assignments`; the three assignment surfaces differ only in the `assignment_method` they record.

## Database assessment — no migration required

I reviewed the schema against this UX. Everything needed already exists:
- `shift_assignments.assignment_method` already has `manual | ai_suggested | auto_assigned` — enough to report "how was this filled".
- `shift_assignments.clock_in_time / clock_out_time / actual_hours_worked` cover the Live tab.
- `shifts.ai_match_score` stores the score at assign time.

Optional, only if you want it (say the word and I'll include it):
1. `shift_assignments.assigned_by uuid` — audit of *who* approved the fill.
2. Index `shifts (agency_id, shift_date, status)` — matters once you pass a few thousand shifts.

I'd rather **not** change the data model for a UI consolidation; the current tables already model this workflow correctly.

## Implementation steps

1. Extract `LiveOperations` body into `src/components/schedule/LiveOpsView.tsx` (keeps realtime channel + 30s refresh, receives `agencyId`).
2. Extract Quick Assign's matching UI into `src/components/schedule/SmartAssignSheet.tsx` (props: shift, onAssigned) — reuses `match-caregiver` and `AssignShiftDialog`.
3. Extract Auto Schedule's batch run into `src/components/schedule/AutoFillDialog.tsx` (range preview → confirm → commit via `assignShift`).
4. Wire all three into `src/pages/Schedule.tsx`: add `today` tab, add row/header actions on the Unassigned tab.
5. Routes: `/live-operations`, `/quick-assign`, `/auto-schedule` → `<Navigate to="/schedule?tab=...">`; add `?tab=` and `?shift=` URL sync so deep links still work.
6. Nav/RBAC: map `live_operations`, `quick_assign`, `auto_schedule` modules to `/schedule` in `usePermissions.ts` and hide their duplicate sidebar entries (permissions rows stay, so access control is unchanged).
7. Delete the three now-empty page files.

## Technical notes

- No DB migration, no edge-function changes — `match-caregiver` is reused as-is.
- Tab visibility is still permission-driven: a user without `quick_assign` read simply doesn't see the Smart Assign action.
- Auto-fill remains **preview-then-confirm**; it never writes without manager approval.
