# TeachEd AI Assistant Plan

## Goal
Create a teacher-first AI assistant that helps build boards, lesson flows, exercises, homework and reusable materials without breaking the current manual workflow.

## MVP Scope
- Board helper: generate a clean board structure from topic, level, duration and skill focus.
- Selected-card helper: rewrite, simplify, translate, explain, expand or turn selected content into tasks.
- Lesson flow helper: produce warm-up, presentation, controlled practice, freer practice, homework and reflection stages.
- Game helper: convert vocabulary or text into matching, sorting, gap-fill, true/false and discussion games.
- Export helper: create teacher notes, student handout and homework summary from a board.

## Board UX
- Add an AI button in the left toolbar that opens a dedicated assistant panel.
- Support context actions when cards are selected: improve text, create questions, make vocabulary, summarize, generate next activity.
- Generated boards must use existing card types and automatic layered placement.
- Every AI action should preview before applying, with "Apply to board" and "Copy" actions.
- Keep teacher control: no silent overwrites, no deleting existing cards without confirmation.

## Data Model
- Store AI generations as regular cards, stages and lesson metadata.
- Add optional `ai` metadata to generated cards: prompt, source, createdAt, model, confidence.
- Save reusable prompts/templates in local storage first, then backend when VPS API is ready.

## Backend/API Phase
- Add `/api/ai/lesson-plan`, `/api/ai/board`, `/api/ai/card`, `/api/ai/game`, `/api/ai/export`.
- Add usage limits by tariff: free daily requests, pro monthly quota, school team quota.
- Add admin controls for enabling/disabling AI, reviewing usage and setting manual credits.

## Free/API Provider Strategy
- Default mode: local teacher templates with no external API, no keys and no cost.
- Test mode: bring-your-own-key providers stored only in the teacher browser.
- Candidate free-tier providers: Gemini API, OpenRouter free models and Groq free-tier models.
- Production mode: VPS backend proxy stores provider keys server-side, rotates models and enforces tariff quotas.
- Fallback rule: if an external provider fails, the assistant should still return a local template result.

## Safety & Quality
- Always show generated content before inserting.
- Keep sources visible when generation is based on pasted text.
- Add language/level controls: CEFR, student age, lesson goal, teacher language.
- Add fallback templates for offline/demo mode.

## Milestones
1. UI shell and plan panel on board.
2. Local template generator without API.
3. Selected-card AI actions.
4. Full lesson/board generator.
5. Backend API, quotas and admin controls.
6. Community-ready AI board templates.
