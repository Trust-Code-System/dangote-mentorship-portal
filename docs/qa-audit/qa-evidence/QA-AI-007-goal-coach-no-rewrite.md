# QA-AI-007 — AI features appear inactive on production (Goal Coach returns no rewrite)

**Severity:** P2 (observation — verify keys) · **URL:** /goals · **Role:** Mentee · **Lang:** EN · 2026-07-24

## Repro
1. Start a new goal, title = vague "get better at leadership".
2. Step 2 → click **Ask the Goal Coach**.

## Observed
Response: "SMART readiness: **0%** · Still missing: Specific, Measurable, Achievable, Relevant, Time-bound · **No rewrite suggestion this time — use the readiness check above.**"

The readiness check is deterministic (`features/goals/smart.ts`); the **AI rewrite** (the headline feature) produced nothing.

## Interpretation
Strongly suggests `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are **not set on Vercel Production**, so AI-rewrite/summary/translation features silently degrade (CLAUDE.md: AI features degrade gracefully when keys unset). This would affect all 8 AI assistants (Goal Coach rewrite, Session summary, Review assistant, Newsletter, Translation, Atlas copilot, Matching rationale is deterministic so unaffected).

## Guardrail PASS
The coach output was advisory and **did not auto-save** — CLAUDE.md rule 5 upheld.

## Action
Confirm AI key configuration for Production on Vercel. If AI is intended for the pilot → P2 (core feature category non-functional). If deliberately off → mark "expected/degraded by config" and surface it in the UI.
