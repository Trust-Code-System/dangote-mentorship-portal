# Handoff — BLAK MOH portal, continuing from the website audit

Paste the **Prompt** section below into a new Claude Code session in
`C:\Users\Admin\Desktop\dangote-mentorship-portal`.

---

## Prompt

> Continuing work on the BLAK MOH mentorship portal (`C:\Users\Admin\Desktop\dangote-mentorship-portal`,
> Next 16 App Router, deployed at https://dangote-mentorship-portal.vercel.app).
>
> A full website audit and its remediation just finished — PRs #38–#47 are merged and live,
> `main` CI is fully green, and production is verified healthy (0 CSP violations). Read
> `CHANGELOG.md` from the "Audit — WCAG 2.2 AA" entry down for the detail; the memory files
> `website-audit-2026-08`, `build-parity-webpack-vs-turbopack` and `incident-dep-bump-500s`
> carry the context that is not in the code.
>
> **Before you touch anything, four hard-won rules from that work:**
>
> 1. **Never merge a grouped dependency bump.** Dependabot #43 (34 packages) passed all 8 CI
>    checks *including a Vercel preview deploy* and still took production to 500 on every
>    route. It was reverted in #46. Split dependency bumps so a failure is attributable, and
>    **always curl production directly** (`/` and `/api/health`) after anything that touches
>    dependencies — CI green is not evidence.
> 2. **CSP is enforced with a nonce.** `src/lib/security/csp.ts` builds it per request in
>    `src/proxy.ts`. Do **not** add `'strict-dynamic'` — Turbopack emits one async chunk
>    without a nonce, and it blocked a script on every page load. `tests/e2e/csp-nonce.spec.ts`
>    fails loudly if it comes back. Any new third-party origin needs a `connect-src` entry.
> 3. **`src/proxy.ts` wraps Auth.js from the outside on purpose.** Do not refactor it to the
>    `auth((req) => …)` wrapper form: that makes next-auth skip the `!authorized` branch that
>    redirects to `/login`, and the route gate silently stops gating while every test still
>    passes.
> 4. **Verify with measurement, not with tools alone.** Four audit findings were tool false
>    positives (skip-link "obscured", `sr-only` "clipped at 200% zoom", hero contrast, and
>    nine static-scan header/alt misses). `scripts/measure-hero-contrast.mjs` is the pattern:
>    turn "the tool says maybe" into a number.
>
> **What is open, highest value first:**
>
> - **PR #18 — Tailwind CSS 3 → 4.** Not merged deliberately. It is a major migration against
>   a custom `blak-*` design system (`tailwind.config.ts`, `docs/design-system.md`), and v4
>   changes utility *ordering*, which this codebase depends on for the `sr-only` / `focus:`
>   interplay on the landing skip link. Needs a dedicated session with visual regression review,
>   not a drive-by merge.
> - **PR #15 — Vercel Web Analytics.** Not merged deliberately. It beacons to
>   `vitals.vercel-insights.com`, which the CSP `connect-src` does not allow, so it would
>   silently not work. More importantly, adding analytics to an auth-gated HR portal holding
>   participant data is a privacy decision for the owner, not a technical one.
> - **Confirm `SENTRY_AUTH_TOKEN` on Vercel.** It gates source-map upload and cannot be checked
>   from outside. Related: the build now runs Turbopack everywhere (the `--webpack` pin was
>   dropped in #45); the pin's original commit claimed webpack "keeps Sentry source-map upload
>   working", so confirm maps still upload.
> - **A human glance at the new loading state while signed in.** #47 replaced every in-shell
>   skeleton with the brand mark. Both tones were rendered against the real stylesheet, but the
>   authenticated routes were only verified structurally (tests + E2E), never actually looked at.
>
> **Environment gotchas that will waste your time otherwise:**
>
> - `AUTH_URL` in `.env` is `:3000` while Playwright uses `:3001`. Pre-existing. It makes local
>   redirects and `metadataBase` point at 3000.
> - `@testing-library/react` is in `package.json` but its `@testing-library/dom` peer is **not
>   installed** — component tests drive `react-dom` + `act` directly. See
>   `tests/shell/branded-route-loader.test.tsx`.
> - E2E needs `SEED_DEFAULT_PASSWORD` from `.env` exported, and `CI=1` to serve a production
>   build. Running it regenerates `*-evidence/` screenshots — do not commit that churn.
> - Prisma's engine DLL locks on Windows; kill any stray `next start` before `npm install`.
> - Direct `git push origin main` is blocked by the harness. Emergency reverts go through
>   branch → PR → `gh pr merge` (about two minutes).
> - `npm audit fix` makes this repo **worse** (2 high → 10 incl. 1 critical). Security pins live
>   in `package.json` `overrides`, and `brace-expansion` is scoped to `minimatch@^10` because a
>   blanket pin breaks ESLint's `minimatch@3`.
>
> Ask me what to work on rather than assuming — but if I say "just carry on", start with the
> `SENTRY_AUTH_TOKEN` check and the signed-in look at the loading state, since both are quick
> and both are currently unverified.

---

## State at handoff

| | |
| --- | --- |
| `main` | `02ac78c` — CI fully green (all 8 checks) |
| Production | healthy: `/` 200, `/api/health` 200, gated routes 307, **0 CSP violations** |
| Merged this stretch | #38, #39, #40, #41, #42, #44, #45, #46 (revert), #47 |
| Reverted | #43 — grouped dep bump, caused a production outage |
| Left open on purpose | #18 (Tailwind 4), #15 (Vercel Analytics) |
| Tests | 336 unit, 39 Playwright E2E |

Audit report: https://claude.ai/code/artifact/9470fba9-d7c9-4eff-bd27-943c915f5c9e
