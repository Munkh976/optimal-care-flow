# Lemonade-style conversation UX for /assistant

Rebuild the caregiver screening surface as a single scrolling, white, mobile-first conversation with section dots, inline answer buttons, and a bottom sheet for multi-select / free-text steps. No database migration is required — everything needed (prompt, helper_text, node_type, allow_skip, allow_free_text, free_text_label, options) already exists in `flow_nodes` / `flow_options`, and answered history already lives in the flow engine state.

## What gets built

**New conversation surface** (replaces `ChatWidget` on `/assistant` for the caregiver flow; the existing widget stays available for the family intake / registration embed until the new one is proven, then both switch over).

Structure, top to bottom:
- Back arrow, top left — rewinds one question (uses existing `back()`); hidden on the first question.
- Centered section title in gray medium weight ("Your background", etc.).
- Dot progress row under the title — teal dots for answered questions in the current section, gray for upcoming. Title + dot count animate when the section changes.
- Scrolling transcript: each answered question renders as bold black question text (left aligned, 24px padding) followed by a gray rounded pill aligned right, with a small circular pencil button to the pill's left that rewinds to that question.
- Current question: bold black text, optional gray helper text, then either inline buttons (Pattern A) or the "Answer" trigger (Pattern B).
- Gray "Skip this question →" link when `allow_skip` is true.
- Typing indicator: three animated dots for 400ms after each answer, then the next question fades in and the view scrolls to it.

**Pattern A — inline buttons.** Single-select nodes with 4 or fewer options: full-width rounded rectangle buttons, white fill, light gray border, bold centered text, optional leading care-context icon. Tapping hides the buttons instantly, shows the pill, runs the typing delay, reveals the next question.

**Pattern B — bottom sheet.** Multi-select nodes, free-text nodes, and the focused single-select (Q1 experience): the question shows a teal "Answer" button / "Tap to select…" placeholder row. Tapping opens a bottom sheet with a handle bar, the question repeated as heading, teal checkboxes (multi-select) or a large textarea using `free_text_label` as placeholder, and a teal "Continue" button. On Continue the sheet closes, the pill appears, typing indicator runs, next question fades in.

Pattern selection is derived from the node itself — `node_type` multi-select or free-text → Pattern B; single-select with ≤4 options → Pattern A; single-select with more options also falls back to Pattern B. This keeps managers' Flow Builder edits working without a hardcoded question list.

**Pill summaries:** single answer → the label; multi-select → first item + "and X more" past two items; free text → the text, truncated; skipped → "Skipped".

**Sections:** a small client-side config maps each question's position in the published flow order to one of the five sections (Your background 3, Your availability 3, Your qualifications 1, How you care 2, Getting started 3), with a safe fallback that groups any extra questions into the final section so a manager adding a question never breaks the header.

## Technical details

- New files: `src/components/chat/ConversationSurface.tsx` (layout, transcript, typing indicator, section header), `src/components/chat/AnswerSheet.tsx` (bottom sheet built on the existing shadcn Sheet with `side="bottom"`), `src/components/chat/AnswerPill.tsx`, `src/components/chat/SectionProgress.tsx`, `src/lib/conversationSections.ts`.
- `src/pages/Assistant.tsx` renders the new surface for the caregiver flow; the topic chooser and family intake path are kept.
- Colors, radii, and the teal accent are added as semantic tokens in `index.css` / `tailwind.config.ts` (`--conversation-accent`, pill and border tokens) — no hardcoded hex in components. Light surface is forced for this page only.
- Reuses `useConversationFlow` unchanged: `answer()`, `back()`, `complete()`, `state.answers` for transcript, `flow.nodes` for section math. `linkRegistration` / completion callbacks keep working so caregiver registration and the manager screening review are unaffected.
- Existing `QuestionCard` / `NavControls` / `ChatWidget` stay for the embedded registration step in this pass.
- Verified in the browser with Playwright: full run through all questions, back/pencil rewind, skip, and sheet interactions, at mobile and desktop widths.
