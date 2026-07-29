# Conversation Builder v2 — fixes, branching model, and trait scoring

## Can the current architecture absorb Claude's design?

Yes — it already *is* that design, minus two layers. What exists today:

- `flow_nodes` = question nodes, `flow_options` = answers with `next_node_id` (the `SELECT next_question_id FROM answers WHERE id = $answer_id` lookup, already implemented client-side against preloaded flow data).
- `flow_options.score_weight` + `trait_tag` = a single-trait version of `trait_weight_json`.
- `conversation_answers` = the labeled training corpus (every selected option, label, free text, sequence index, soft-deleted on Back — nothing lost).
- Back/Skip already work: Back pops the answer stack, Skip follows `default_next_node_id`.

So no rewrite. Three additive changes get us to the full vision: multi-trait weights, a normalized 0–10 profile, and a manager review/labeling queue later. No ML, no vector DB, no LLM.

## Issue 1 — Fields reset while typing

`addQuestion` / `addOption` insert a placeholder row then refetch the whole flow, and every save refetches too, so the edited row is replaced mid-edit and inputs lose their text.

Fix: keep an in-memory draft of the selected question and its answers. New question/answer rows are added to local state only and written on Save. After Save, patch the single changed row in state instead of refetching the whole flow.

## Issue 2 — Branching should be owned by the previous question (no spider trap)

Today any answer on any question can point at any other question, so several parents can claim the same child and flows tangle.

New model, same tables:

```text
Question 3  "Why caregiving?"
  ├─ Answer A  →  next: Question 4
  ├─ Answer B  →  next: Question 7
  └─ Answer C  →  next: (default)
Default next (Skip / no branch)  →  Question 4
```

- The "next question" dropdown on an answer only lists questions that are **after** the current one in sort order and are **not already claimed** by another question's answer or default. A question therefore has exactly one parent.
- Removing a branch frees that question for another parent.
- The tree view shows each question with its children indented underneath, so the manager reads the flow top-down.
- A validation panel flags: unreachable questions, questions with no way out, and any answer pointing backwards.

## Issue 3 — No "end the conversation" answer

Terminal answers let a candidate exit on question 1 and land on the registration form with nothing scored.

- Remove the "Ending" node type and the "End conversation" choice from answer/default next-question dropdowns in the builder.
- The flow ends only when the last question in the chain is answered.
- Skip stays, because skipped answers are still recorded rows (`skipped = true`) — valuable labels — but a skip cannot jump past the end of the tree.
- The registration form is only reachable from the completion screen.

## Issue 4 — Multi-trait scoring and the candidate profile

- Add `trait_weights` (JSON) to answers: `{"conscientiousness": 2, "agreeableness": 1, "ice": 0}`. The existing `trait_tag` + `score_weight` is migrated into it automatically, and the builder gets a small weight grid across the five dimensions: conscientiousness, agreeableness, emotional stability, ICE (intergenerational care experience), resilience.
- On completion, sum weights per trait and normalize against the maximum obtainable for that trait in the flow → 0–10 per dimension, stored on the session.
- The manager's screening dialog gains a radar/bar profile of the five dimensions plus the band, and the existing PDF export includes it.

## Build order

1. Migration: `trait_weights` JSON on `flow_options`, per-trait profile on `conversation_sessions`, backfill from existing weights.
2. Flow Builder: draft-based editing (fixes the reset), parent-owned next-question dropdowns, tree view, validation panel, trait weight grid, terminal removal.
3. Flow engine: multi-trait accumulation + normalization; drop terminal handling.
4. Screening result dialog + PDF: five-dimension profile.
5. Verify: build a 3-branch flow in the builder, run it at `/assistant`, test Back/Skip, confirm the application shows the profile.

## Deliberately deferred

The intent classifier and retraining flywheel only matter once free-text answers exist at volume. Every click is already stored with its label, so that corpus is accumulating now; the review queue and TF-IDF classifier can be added later without touching this schema.
