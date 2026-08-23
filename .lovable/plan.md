# Agency HR Pipeline — Step 1: Inspection & Proposal

## a. Reconciliation of inbound family demand

**What exists today (verified against live data):**

| Path | Produces | Where HR sees it |
|---|---|---|
| `/assistant` + homepage widget (no agency scope) | `conversation_sessions` row only (`submitted_at` set, `follow_up_status`) | Client Inquiries |
| `/a/:slug/care` (public office) | `conversation_sessions` row **and** a `care_requests` row (`source='public_site'`, `agency_id` + `virtual_office_id` set) | Client Inquiries shows the session; the `care_requests` row is displayed **nowhere** |

Current counts: 5 submitted sessions, 0 `care_requests` (the verification rows were cleaned up).

So public intakes *do* show up for HR today — but only through their session shadow, and the
structured `care_requests` record (the row the rest of the system will schedule against) has no
surface at all. Naively adding `care_requests` to Client Inquiries would double-list every public
intake, because each one owns both records.

**Recommendation — option (ii): `care_requests` is the authoritative inbound list; sessions feed it.**

- Every submitted family intake produces exactly one `care_requests` row. The RPC
  `flow_session_submit_intake` already does this when scoped; it will be extended to also create the
  row for unscoped intakes (agency resolved from the flow's `agency_id`, else the session's agency),
  keeping its existing "already submitted" guard so a resubmit never duplicates.
- `care_requests` gains a `session_id` link (nullable) so the request is the row of record and the
  session is its transcript. Existing submitted sessions are backfilled one-to-one.
- Client Inquiries reads `care_requests` and joins the linked session for the Q&A transcript,
  contact preference and the existing `follow_up_status`. One intake = one card, always.
- No duplicate is possible by construction: the list keys on `care_requests.id`, and a session
  without a request cannot exist after backfill (unique index on `care_requests(session_id)`).

## b. Virtual-office scoping

| Inbound row | Carries `virtual_office_id` today? |
|---|---|
| `care_requests` from `/a/:slug/care` | Yes |
| `care_requests` backfilled from legacy sessions | No (null = "unassigned office") |
| `caregiver_registrations` from `/a/:slug/apply` | **No — the column does not exist on the table** (only `agency_id` is set; 3 of 16 rows have it) |
| `caregiver_registrations` from `/caregiver-registration` | No agency, no office |

Proposal: add a nullable `virtual_office_id` to `caregiver_registrations` (additive, FK to
`virtual_office`) and populate it from the public-office apply path. Add an optional "Office" select
to both surfaces — `All offices` (default), each active office, and `Unassigned` — visible only when
the agency has more than one office, so single-office agencies see no new chrome.

## c. Filtering on Caregiver Applications

Available **at registration time**: name, email, phone, address/city/state/`zip_code`,
`employment_type`, `hourly_rate`, `care_type_codes` (9 of 16 rows have them), the free-form
`availability` jsonb, `status`, `created_at`, plus the linked screening session's `total_score`
and `band`.

Only available **after approval**: `caregiver_skills`, `caregiver_preferences`, certifications,
service radius/zip arrays — these rows are created by the approval edge function.

So the added filters use pre-approval data only:
- Text search across name / email / phone / city / zip.
- Care Services multi-select matching `care_type_codes` (overlap), using `useCareServices`.
- Employment type (full time / part time / on call) and desired-rate max, from `hourly_rate`.
- Screening band (strong fit / review / not a fit) from the joined session.

**Flagged, not built:** true availability filtering (day/time windows) and travel-radius/service-area
filtering. `availability` is unstructured at registration and preferences don't exist pre-approval —
filtering on them would be fake. If HR wants these, screening must capture them first.

## d. Genuine gaps HR needs to act on inbound

Only two, both minimal:
1. **Care-request lifecycle** — move a request `new → reviewing → matched/cancelled` from the card,
   mirroring the existing `follow_up_status` control (which stays and stays in sync).
2. **Internal notes** — write to the existing `care_requests.notes` and add a `notes` column to
   `caregiver_registrations` so HR can record why an applicant was parked.

Not in scope: assignment-to-staff (no owner column, no staff picker justified yet), matching,
scheduling, converting an inquiry into a client/care plan.

## e. Safety

All work is additive: two nullable columns (`caregiver_registrations.virtual_office_id`, `.notes`),
one nullable `care_requests.session_id` + unique index, a backfill, and an extension of the existing
`flow_session_submit_intake` RPC. Reads stay under current agency-scoped RLS; the new writes
(status, notes) are staff-only under existing policies and get explicit policies where a table lacks
an UPDATE path. No new grants to `anon`, no change to `get_public_office`, no change to 2A RLS on
existing tables, 2B triggers, 2.5 eligibility functions, or the public page. Approve/reject keeps
running through the unchanged edge function.

## Technical notes

- Enhance `src/pages/ClientInquiries.tsx` and `src/pages/CaregiverApprovals.tsx` in place; no new pages.
- New shared filter bar built from existing shadcn `Input`/`Select`/`Badge` primitives.
- Migration order: columns + index → backfill sessions into `care_requests` → RPC update.
