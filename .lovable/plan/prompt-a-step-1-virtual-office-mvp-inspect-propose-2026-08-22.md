# Prompt A — Step 1: Virtual Office MVP (inspect & propose)

## a. Current jsonb shapes (as stored today)

Both existing VO rows (one per agency, `code = "PRIMARY"`, `name = "Primary Office"`, `is_primary = true`) hold:

| field | current value |
|---|---|
| `branding` | `{}` — empty |
| `service_area` | `{}` — empty |
| `operating_hours` | `{}` — empty |
| `service_states` / `service_zipcodes` | `[]` |
| override columns | all NULL |

So there is no real shape yet — the defaults were never written to. **No columns are missing**; `branding` is a jsonb bag and is wide enough. No schema change is needed. Proposed conventional shapes the UI will read/write (additive, inside existing jsonb):

```text
branding = {
  display_name: string,      // public-facing name, may differ from vo.name
  tagline: string,
  logo_url: string,          // URL/ref only, no upload pipeline this phase
  primary_color: "#0D9488",  // hex
  secondary_color: "#0F172A"
}

service_area = {
  radius_miles: number|null,
  center_zip: string|null,
  notes: string
}

operating_hours = {
  "0".."6": { closed: boolean, start: "08:00", end: "18:00" }   // 0 = Sunday
}
```

The UI reads defensively (missing keys → empty/inherit) so pre-existing `{}` rows load fine.

## b. Nav + RBAC

`usePermissions` reads `role_permissions × system_modules` for the caller's role, maps `module_code → route` in a hardcoded map, and `AppLayout` groups by `system_modules.category`, hiding `platform` modules from agency roles and non-platform modules from system_admin.

Proposal — one new row in each table, using the existing mechanism only:

- `system_modules`: `module_code = 'virtual_offices'`, `module_name = 'Virtual Offices'`, `category = 'configuration'` (sits next to Agency Settings).
- `role_permissions`:
  - `agency_admin` — create/read/update true, delete false (VOs are deactivated, not deleted).
  - `manager` — read only.
  - `hr_staff`, `scheduler`, `caregiver`, `client` — no row (invisible).
  - `system_admin` — no row: the module is `configuration`, so the platform portal filter hides it; system_admin retains DB-level access via RLS but gets no agency-portal nav item.
- `usePermissions` route map: `virtual_offices: "/virtual-offices"`. Icon: `Building2`-family (`Network`) in `AppLayout`'s `iconMap`.

## c. RLS

Existing `virtual_office` policies are sufficient — no new policy needed:

- SELECT: `agency_id = current_agency_id()` OR system_admin
- INSERT / UPDATE / DELETE: `is_agency_staff(auth.uid()) AND agency_id = current_agency_id()` OR system_admin

That covers list, create, config-save, and activate/deactivate. Cross-tenant reads and writes are already denied. Grants already exist.

## d. Pages, routes, components

| route | file | purpose |
|---|---|---|
| `/virtual-offices` | `src/pages/VirtualOffices.tsx` | list + create + primary/active toggles |
| `/virtual-offices/:id` | `src/pages/VirtualOfficeConfig.tsx` | per-VO config, tabbed |

Components (new, under `src/components/virtual-office/`), all shadcn + AgencySettings card/form styling:

- `CreateVirtualOfficeDialog.tsx` — name + code.
- `BrandingCard.tsx` — display name, tagline, logo URL, primary/secondary color.
- `ServiceAreaCard.tsx` — `service_states[]` (reuse `US_STATES`), zip chips, radius/center/notes.
- `OperatingHoursCard.tsx` — 7-row day editor.
- `ContactCard.tsx` — contact email/phone + address/city/state/zip.
- `SchedulingOverridesCard.tsx` — the four nullable overrides, each labelled "Override agency default (blank = inherit)", showing the agency value beside it, persisting NULL for blank, with the note "Stored now; scheduling will use these in a later phase."

Reused as-is: `AppLayout`, `Card`, `Input`, `Label`, `Select`, `Switch`, `Badge`, `Tabs`, `Button`, `sonner` toasts, `US_STATES`.

Writes: insert VO (`agency_id` = caller's `profiles.agency_id`, `is_primary=false`, `is_active=true`, `is_demo=false`); update config; toggle active (blocked on primary); set primary (demote old primary first, then promote, respecting the partial unique constraint).

**Boundary with AgencySettings — no overlap:** AgencySettings edits the `agency` row = the *legal entity* (legal name, business type, tax ID, NAICS, corporate address/phone/email/website, and the agency-wide scheduling defaults). Virtual Offices edit `virtual_office` rows = *operating, branded sub-units* (brand presentation, service area, operating hours, local contact, and optional overrides of the agency defaults). No field is written by both surfaces; the only touchpoint is an optional link between the two pages.

## 3. Per-VO filtering of operational pages (report only — not implemented)

Future approach, no plumbing now: `caregivers.virtual_office_id` and `clients.virtual_office_id` already exist and are backfilled; `shifts` has none and would resolve VO through its client. The future phase adds a single `VirtualOfficeContext` (selected VO in localStorage) plus a header switcher, and each operational query appends `.eq("virtual_office_id", vo)` when a VO is selected ("All offices" = no filter). Shifts filter via a client-id subquery until a shift-level VO column is justified. Nothing on Schedule/Caregivers/Clients changes in this phase.

## Step 2 (after approval)
Build the two pages, the six components, the one `system_modules` + role_permissions row, the route-map entry, and run the listed cross-tenant / primary-guard / override-inertness tests.
