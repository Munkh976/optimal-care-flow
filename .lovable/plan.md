# Rule-Based Conversation Flow Engine

A guided, button-driven AI assistant for CareMuch. No LLM in v1 — every question offers 4-5 tap-able answers, with Back and Skip. Branching is stored as data, so managers can edit flows without a code deploy.

## Goals

- Caregiver applicants complete a personality/fit screening by tapping answers, and a scored application lands in Caregiver Applications.
- Client family members complete a care intake that produces a structured request for the agency.
- Every answer is logged as labeled training data for a future ML classifier.

## User Experience

```text
+--------------------------------------------+
|  CareMuch Assistant          Step 4 of 12  |
|  [======-------------------]               |
+--------------------------------------------+
|  How do you handle a client who refuses     |
|  their medication?                          |
|                                             |
|  [ Stay calm and try again later        ]   |
|  [ Call the family right away           ]   |
|  [ Document it and notify the office    ]   |
|  [ Respect their choice, no follow-up   ]   |
|                                             |
|  ( Back )                     ( Skip > )    |
+--------------------------------------------+
```

- Mobile-first, full-width tap targets.
- Progress bar with "Step X of Y".
- Back pops the last answer and restores the previous question exactly.
- Skip records a skipped answer and follows the question's default next step.
- Sessions resume: leaving and returning restores position.
- 2-3 designated questions also allow an optional free-text box (for future hand-labeling). Never blocking.
- Completion screen summarizes what happens next and, for caregivers, submits the application.

## Data Model (new tables)

**conversation_flows** — audience (`caregiver_screening`, `family_intake`, `general`), name, description, version, is_active, entry node.

**flow_nodes** — belongs to a flow. Fields: key, prompt text, helper text, node type (`single_select`, `multi_select`, `info`, `contact_capture`, `terminal`), allow_skip, allow_free_text, sort order, default_next_node_id.

**flow_options** — belongs to a node. Fields: label, short value, sort order, `score_weight` (numeric), `trait_tag` (patience / reliability / communication / boundaries / safety), `next_node_id`.

**conversation_sessions** — flow_id, agency_id, optional user_id, anonymous visitor token, status (`in_progress`, `completed`, `abandoned`), current_node_id, total score, per-trait score JSON, outcome record link (registration id), started/completed timestamps.

**conversation_answers** — session_id, node_id, selected option ids, free_text, skipped flag, sequence index, answered_at. Back navigation soft-deletes by trimming to a sequence index so the trail stays auditable.

Access rules in plain English:
- Anyone visiting the public site can start a session and record their own answers, identified by their session token; they cannot read anyone else's.
- Flow definitions are readable publicly (they are just questions), but only agency admins and system admins can create or edit them.
- Managers and admins can read all sessions and answers for their agency.
- Nobody can hard-delete answers; sessions can be archived.

## Scoring

Each option carries a weight and a trait tag. On completion the engine computes:
- Total score = sum of weights.
- Per-trait subtotals.
- A band: `strong_fit` / `review` / `not_a_fit`, using thresholds stored on the flow.

For caregiver screening, the completed session writes a `caregiver_registrations` row with the score, band, trait breakdown, and a link back to the transcript. The existing manager Approve/Reject workflow is unchanged — it simply now shows the screening result.

## Application Structure

- `src/lib/flowEngine.ts` — pure functions: `nextNode(node, option)`, `applyAnswer(state, answer)`, `goBack(state)`, `computeScore(answers)`. Fully unit-testable, no React or network.
- `src/hooks/useConversationFlow.ts` — loads a flow, manages session state, persists answers, handles resume.
- `src/components/chat/ChatWidget.tsx` — the shell (header, progress, message list).
- `src/components/chat/QuestionCard.tsx` — prompt, option buttons, optional free-text.
- `src/components/chat/NavControls.tsx` — Back / Skip.
- `src/components/chat/CompletionCard.tsx` — outcome summary.
- Route `/assistant` for a full-page version; the widget also mounts on the public landing page and the caregiver registration page.

## Manager-Facing Admin

- New page `/flow-builder` (agency admin + system admin only, registered in `system_modules` + `role_permissions` so it appears in the nav).
- List flows, create/edit nodes, drag to reorder, edit options with weight and next-node dropdown.
- A visual "orphan/dead-end" check so a flow can't be published with unreachable nodes.
- Preview mode to walk the flow without saving a session.

## Seed Content

- Caregiver screening flow: ~12 questions covering availability, experience, transport, a scenario on client refusal, a scenario on a family conflict, boundaries, reliability, and a free-text "describe a difficult situation".
- Family intake flow: ~8 questions covering who needs care, services needed (pulled from Care Services), days/times, urgency, and contact capture.

## Build Order

1. Migration: the five tables, grants, access rules, updated-at triggers.
2. `flowEngine.ts` + unit tests for branching, back, skip, scoring.
3. `useConversationFlow` hook with session persistence and resume.
4. Chat widget UI and the `/assistant` route.
5. Seed both flows with real content.
6. Wire caregiver completion into `caregiver_registrations` and surface the score in Caregiver Applications.
7. Flow Builder admin page + nav registration.
8. End-to-end verification: complete both flows, test Back/Skip, reload mid-flow, confirm an application appears with the correct score.

## Technical Notes

- No LLM, no edge function needed for v1 — the engine runs client-side against flow data, with answers persisted directly. This keeps latency near zero and cost at zero.
- Anonymous visitors are supported via a generated session token stored in localStorage, so applicants don't need an account before screening.
- Free-text answers are stored but not scored in v1; they are the seed corpus for a later classifier.
- Later LLM layer, when you want it, is additive: a "type your own answer" field whose text is mapped onto one of the existing options. The flow data and scoring do not change.

## Out of Scope for This Phase

- ML intent classification and auto-retraining.
- Voice input.
- Multi-language flows (the schema leaves room via a locale column later).
