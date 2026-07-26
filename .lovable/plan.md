## Why you can't see the approvals screen

The pages exist (`/caregiver-approvals`, `/notifications-outbox`) but the sidebar is built **only** from the module registry in the database. That registry currently has 8 modules (dashboard, schedule, caregivers, clients, orders, users, settings, reports). Caregiver Approvals, Notification Outbox, Care Types, Time Off, Live Ops, Quick Assign, Auto Schedule, Available Shifts, User Roles, System Roles, Role Permissions are **not registered**, so no role — including agency admin/manager — ever sees a link to them. Nothing is broken in the pages; the menu just doesn't know they exist.

## Plan

### 1. Register the missing modules
Add the missing modules to the registry with proper categories, and grant them to the right roles:

| Module | Category | Roles with read |
|---|---|---|
| Caregiver Approvals | operations | agency_admin, manager, hr_staff |
| Notification Outbox | operations | agency_admin, manager |
| Time Off, Shift Trades, Live Ops, Quick Assign, Auto Schedule, Available Shifts | operations | agency_admin, manager, scheduler |
| Care Types, Agency Settings | administration (agency) | agency_admin, manager |
| User Roles, System Roles, Role Permissions, Admin Utilities | platform | system_admin only |

Approve/reject rights map to create/update on the approvals module, so the buttons on the page respect permissions.

### 2. Surface approvals where you'd expect it
- Sidebar entry under Operations for agency admin / manager / HR.
- A **pending approvals count badge** on the sidebar item and a card on the Agency dashboard linking straight to it.
- A secondary "Applications" tab/button on the Caregivers page, so caregiver management and approvals live together.

### 3. Separate the two portals
Split the navigation into two distinct shells driven by role, rather than one merged list:

```text
System Admin portal (system_admin)      Agency portal (agency_admin & below)
- Platform overview & health            - Agency dashboard (ops KPIs)
- System users (all agencies)           - Agency staff/users
- System roles & access levels          - Caregivers / Applications
- Role permissions matrix               - Clients / Orders
- Module configuration                  - Schedule, Live Ops, Quick Assign
- Admin utilities / backfills           - Time off, Trades, Care types
- Platform analytics                    - Agency analytics & reports
- Notification outbox (all)             - Agency settings
```

- Nav groups become `platform` vs agency categories; system admin sees the platform group, agency roles never do.
- Post-login landing: system admin → `/system-admin`, agency roles → `/dashboard`, caregiver/client → their own dashboards.
- Optional visual cue: portal label under the "CareMuch" logo ("System Administration" vs the agency name).

### 4. Split the analytics
- **Agency reports** (`/reports`) stays operational: shift fill rate, caregiver utilisation, client hours, time-off trends — scoped to the agency.
- **Platform analytics** (new section on the System Admin dashboard): user/account counts by role, accounts without logins, module & permission coverage, registration funnel (pending/approved/rejected), edge-function and data-integrity checks. No care-delivery metrics.

### 5. Guardrails
Each admin route already checks the signed-in role server-side via the role function; I'll make the platform routes consistently reject non-system-admins and redirect agency users back to `/dashboard`, so hiding the menu isn't the only protection.

## Technical notes
- Module/permission additions go in one database migration (registry rows + role grants); route mapping added in `usePermissions`.
- `AppLayout` gains category ordering and a portal-mode split; no page rewrites needed.
- Approvals badge uses a count query on pending registrations.
