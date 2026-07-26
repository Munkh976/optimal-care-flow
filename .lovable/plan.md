## Recommendation: approval, not invitations

For a single-agency model, invitations add a mail dependency you don't have yet and a second identity path to maintain. Approval is simpler and matches how your app already works:

- Caregivers self-register (they already do) → manager approves → account activates.
- Clients don't self-register in practice, so staff creates their account directly (already possible via `create-user`), and a one-time password is shown on screen instead of emailed.

No email is sent anywhere. Anything that would have been an email is recorded in the database and shown in the UI, so switching to real email later is one function call, not a redesign.

## How it works

```text
Caregiver:  self-register  ->  pending  ->  manager approves
            (auth account created at registration, but no role)
            approval grants 'caregiver' role + creates/links caregivers row

Client:     staff creates client  ->  optional "create login" toggle
            account created immediately, temp password shown once on screen
```

### Caregiver approval flow
1. Self-registration keeps creating the auth user (as today) and a `caregiver_registrations` row with status `pending`. No role is assigned, so login lands on "pending approval" — that's already the behavior.
2. Caregiver Approvals page gets an **Approve** action that calls a new backend function:
   - grants the `caregiver` role,
   - creates a `caregivers` row (or links an existing unlinked one matched by email),
   - sets registration status to `approved`.
3. **Reject** sets status `rejected` with a reason; the user can still sign in but sees the pending/rejected screen.
4. Approving matches an existing roster caregiver by email when one exists, so you don't get duplicates.

### Client accounts
1. New `client` role plus permissions so clients can read only their own data.
2. On the Clients page, an **Enable login** action creates the auth account for that client, links `clients.user_id`, and assigns the `client` role.
3. The temporary password is generated and shown once in the dialog with a copy button — nothing is emailed.

### Pretend-invite record (future-proofing)
A `pending_notifications` table records what *would* have been sent (recipient, type, payload, `sent_at` null). The approval/creation flows write to it, and an admin screen lists them. When you go to production, a real sender reads the same table — no flow changes.

### Account status in the lists
Both Caregivers and Clients lists get a status column: **Linked** (has login), **Pending approval**, or **No login**, with the relevant action inline.

## Technical details

Database:
- Add `client` to the `app_role` enum; add `role_permissions` rows for it.
- New table `client_users` is **not** needed — `clients.user_id` already exists; keep it nullable and enforce linkage in policies.
- New table `pending_notifications` (recipient email, kind, payload jsonb, created_at, sent_at) with GRANTs, RLS restricted to staff roles and service_role.
- Add `caregiver_registrations.reviewed_by`, `reviewed_at`, `rejection_reason`.
- RLS: caregivers/clients may read and act only on rows where `user_id = auth.uid()`; staff keep agency-scoped access.

Backend functions (service role, caller role-checked):
- `approve-caregiver-registration` — role grant, caregiver row create/link, status update, notification record.
- `enable-client-login` — creates auth user with a generated temp password, links `clients.user_id`, assigns `client` role, returns the password once.

Frontend:
- Caregiver Approvals: approve/reject with confirmation and result toast.
- Clients + Caregivers lists: account-status column and inline action.
- Auth routing: `client` role → `/client-dashboard`; no role → existing pending-approval message.
- Backfill helper in Admin Utilities to link existing 5 caregivers / 5 clients to accounts by email where one exists.

Deliberately out of scope: sending real email, multi-agency invitations, self-registration for clients.
