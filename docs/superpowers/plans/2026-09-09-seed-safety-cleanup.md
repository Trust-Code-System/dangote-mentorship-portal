# Seed Safety Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PR #63 minimal, fail-closed, and current with `main`.

**Architecture:** Keep target parsing and policy evaluation in the existing pure `seed-target` module. Pass the raw environment override from the seed entry point and prove malformed targets are rejected before overrides are evaluated.

**Tech Stack:** TypeScript, Vitest, Prisma seed script, Git

---

### Task 1: Tighten seed-target policy

**Files:**
- Modify: `src/lib/db/seed-target.ts`
- Test: `tests/unit/seed-target.test.ts`

- [ ] **Step 1: Add the regression test**

```ts
it('refuses an unparseable URL even with the broad override', () => {
  expect(evaluateSeedTarget('not a url', 'true').allowed).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and observe failure**

Run: `npx vitest run tests/unit/seed-target.test.ts`

Expected: the new malformed-URL assertion fails.

- [ ] **Step 3: Reject malformed targets before evaluating the override**

```ts
const target = describeDatabaseTarget(databaseUrl);
if (!target) {
  return {
    allowed: false,
    target: '(unparseable DATABASE_URL)',
    reason: databaseUrl ? 'DATABASE_URL is invalid.' : 'DATABASE_URL is not set.',
  };
}
```

Use `string | undefined` for the override because its production source is `process.env`.

- [ ] **Step 4: Run the focused test and observe success**

Run: `npx vitest run tests/unit/seed-target.test.ts`

Expected: all seed-target tests pass.

### Task 2: Reduce PR noise

**Files:**
- Modify: `.env.example`
- Modify: `prisma/seed.ts`
- Delete: `supabase/.gitignore`
- Delete: `supabase/config.toml`

- [ ] **Step 1: Remove comments that narrate obvious code or historical edits**

Keep only concise operator guidance in `.env.example` and security rationale that cannot be expressed by code.

- [ ] **Step 2: Remove unrelated Supabase CLI scaffolding**

Delete both Supabase files; no package script or documentation references them.

### Task 3: Integrate and verify

**Files:**
- Modify as needed: `.env.example`
- Modify as needed: `CHANGELOG.md`

- [ ] **Step 1: Merge current `origin/main` and resolve additive documentation conflicts**

Preserve both the current base entries and the concise seed-safety entry.

- [ ] **Step 2: Run repository checks**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check origin/main...HEAD
```

Expected: every command exits successfully, with no new lint errors or whitespace errors.
