# QA-MATCH-003 — "Run matching" gives no feedback; 0-suggestion result unexplained

**Severity:** P3 · **URL:** /admin/matching · **Role:** Super Admin · **Env:** Prod + code · 2026-07-24

## Repro
1. Open `/admin/matching` (banner: "Language is a hard rule…"; body: "No suggestions yet."). 43 mentees unmatched.
2. Click **Run matching**.
3. Network confirms the action fired: `POST https://dangote-mentorship-portal.vercel.app/admin/matching` → 200.
4. UI is unchanged: still "No suggestions yet. Run matching to generate them." No toast, no loading state, no count.

## Why 0 (verified, not a matching bug)
`src/features/matching/data.ts:61`:
```ts
onboardingComplete: p.trainingStatus === TrainingStatus.COMPLETED,
```
`DEFAULT_HARD_RULES.menteeOnboardingComplete = true`, so every mentee whose training ≠ COMPLETED fails `MENTEE_ONBOARDING_INCOMPLETE`. The 43 unmatched mentees aren't trained → 0 eligible pairs. Mentor directory confirms several mentors ARE trained w/ capacity, so the gap is on the mentee side.

## Why it's a defect
`runMatching` returns `{ suggested, menteesMatched }` but the page surfaces neither. The admin cannot distinguish "ran successfully, nothing eligible" from "failed". No hint that eligibility requires training/onboarding completion.

## Recommended fix
- Show a result toast: `"Generated N suggestions for M mentees"` / `"0 suggestions — X mentees pending training"`.
- Improve the empty state to name the eligibility gate.
