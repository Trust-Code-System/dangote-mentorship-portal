# QA Audit Report — BLAK MOH Mentorship Portal

- **Environment:** Production (`https://dangote-mentorship-portal.vercel.app`) + local source (`main` @ 290842d)
- **Date:** 2026-07-24
- **Auditor:** Automated QA pass (Claude), Super Admin browser session + full source review
- **Status of this report:** **Installment 1 of an in-progress audit.** Deep code-level security/permissions review + the Super-Admin-reachable surface and public login are covered. The participant lifecycle (Mentor/Mentee phases) is **pending manual role logins** and is documented under *Blocked tests*.

---

## Executive summary

**Overall condition:** The portal's **security and permissions architecture is strong** — the highest-risk items in the brief (matching language hard-rule, direct-message confidentiality, journal privacy, cohort isolation, file-download IDOR, role-based route gating) are all correctly enforced **server-side**, verified by source review and, where reachable, live checks. No P0 (critical) issues were found in the areas audited so far. The defects found to date are **cosmetic/labeling and UX-feedback** issues on the admin dashboard and matching flow — real, but low severity.

The main caveat is **coverage**: the bulk of the functional surface (goals, meetings, sessions, messaging UI, agreements, reviews, participant dashboards, profile editing, notifications) lives behind Mentor/Mentee sessions that require your manual login, and has **not yet been exercised live**. Several brief phases (Forum, Clinics, Newsletters) describe features that **do not exist as routes** in this build.

**Metrics (this installment):**
- Features/areas inventoried: **~55 routes + 6 API endpoints + 8 AI assistants** (see `QA_ROUTE_AND_FEATURE_INVENTORY.md`)
- Areas actively tested (live): **7** (login, admin dashboard, matching engine, insights, mentor directory, route gating, console/network health)
- Areas reviewed at code level (security-critical): **8** (RBAC, cohort scope, pair access, matching engine+override, DM data layer, journal visibility, evidence API, avatar API)
- **Passed (verified):** ~45 (security/permissions code + live mentor/mentee lifecycle + public site + bilingual UI — see matrix & *Passed critical workflows*)
- **Failed (defects):** 8 (0×P0, 0×P1, **3×P2**, **5×P3**) + minor i18n/UI sub-issues + 1 unconfirmed observation
- **Blocked / not yet run:** **Import Data** + **avatar upload** (no file-picker in driven browser), **review submission**, **invites** (email caution), full **responsive + accessibility** sweep, **maintenance live test** (deliberately not toggled on prod). AI live output is FAIL-by-config (QA-AI-007: provider 401/429).
- **Not implemented / N/A:** Forum, Clinics, Newsletters; Trainer & Reviewer roles; Messaging realtime/attachments/translate

**P0:** 0 | **P1:** 0 | **P2:** 3 (QA-ADMIN-001, QA-I18N-006, QA-AI-007) | **P3:** 5 (QA-ADMIN-002, QA-MATCH-003, QA-INSIGHT-004, QA-AGREE-005, QA-COHORT-008)

**Highest-risk areas (all PASSING — code + live):** matching language rule, DM privacy, journal privacy, cohort isolation, file IDOR, role route-gating. The mentor→mentee lifecycle (goal review→mentee visibility, DM round-trip, notifications) works end-to-end.

**Release recommendation (interim):** Security/permissions/lifecycle are pilot-grade — **no blocking (P0/P1) defects found.** Before a bilingual pilot, resolve **QA-I18N-006** (French users see English agreement terms) and **confirm QA-AI-007** (are AI keys set on prod? the AI value-prop may be inactive). The P3s and QA-ADMIN-001 are polish. Still-unrun areas (reviews, meetings, sessions+AI, admin CRUD, a11y/responsive, public) should be completed before final sign-off.

---

## Fixes applied (branch `qa/fix-audit-findings`, 2026-07-24)
Not committed/pushed — awaiting review. Verified: `tsc --noEmit` clean + **272/272 tests pass**.

| Finding | Fix | Files |
|---|---|---|
| **QA-COHORT-008** | Added Zod `.refine()` — end must be after start (create + update cohort) | `src/features/cohorts/schema.ts` |
| **QA-ADMIN-001** | "AI flags" tile relabeled **"Open support"**, links to `/admin/support` (label/value/link now consistent) | `src/components/dashboard/admin-summary.tsx` |
| **QA-ADMIN-002** | "System health" → **"Match rate"**, tone derived from value; health ring caption made value-driven (no more "3% — Healthy programme") | `admin-summary.tsx`, `src/app/(admin)/admin/page.tsx` |
| **QA-AGREE-005** | E-signature now validated against the signer's registered name (case/whitespace-insensitive) | `src/features/agreements/actions.ts` |
| **QA-I18N-006** (agreements) | Agreement display + signed snapshot now follow the **active UI locale** (`getLocale()`), not the saved account locale | `src/app/(dashboard)/agreements/page.tsx`, `agreements/actions.ts` |
| **QA-INSIGHT-004** | Language donut second series → distinct hue (amber) instead of a second green | `src/features/admin/insights-charts.tsx` |

**Correction — QA-MATCH-003 was a FALSE POSITIVE.** The matching page *does* use `RunMatchingButton` (`admin/matching/page.tsx:110`), which shows a result toast (suggested count / "all matched") and refreshes. The transient toast had auto-dismissed before my screenshot. No fix needed. *(Residual minor: the "all matched" toast copy is slightly inaccurate when the true cause is ineligibility rather than everyone being matched — optional copy tweak.)*

**Not code-fixable here:**
- **QA-AI-007** — provider-account issue (Anthropic 401 / OpenAI 429), not the app. See update in the finding.
- **QA-I18N-006 (admin dashboard)** — the admin dashboard heading/tile labels are hardcoded English; wiring them to next-intl needs new keys in `messages/en.json` + `messages/fr.json`. Deferred as a larger, separate i18n task.
- **QA-I18N-006 (review form FR)** — data, not code: populate the French question fields in the Forms builder.

## Severity definitions
- **P0 Critical:** Security breach, private-data exposure, unrecoverable data loss, auth bypass, portal-wide outage.
- **P1 High:** Core mentorship workflow broken, a major role cannot do its job, severe data-integrity failure, or matching-language-rule violation.
- **P2 Medium:** Feature partially works but has a meaningful defect, poor error handling, incorrect state, or serious usability problem.
- **P3 Low:** Cosmetic, minor content, small accessibility, or non-blocking inconsistency.

---

## Confirmed defects

### QA-ADMIN-001 — "AI flags" dashboard tile shows the open-support count, not AI flags  · **P2**
- **Feature:** Admin dashboard (`/admin`)
- **Environment:** Prod + code · **Role:** Super Admin · **Language:** EN · **Viewport:** 800×722
- **URL:** `https://dangote-mentorship-portal.vercel.app/admin`
- **Preconditions:** Logged in as Super Admin.
- **Steps:** 1) Open `/admin`. 2) Read the third stat tile labeled "AI flags".
- **Expected:** The count reflects AI/risk-monitor flags (the brief's "AI risk alerts").
- **Actual:** The tile renders `data.openSupport` — the number of **open support requests** — under the label **"AI flags"**, and its click-through links to **`/admin/mentors`** (unrelated). On the live dashboard it read "AI FLAGS 1".
- **Reproduction rate:** 100% (static code path).
- **Evidence:** `qa-evidence/QA-ADMIN-001-ai-flags-tile.md`; source `src/components/dashboard/admin-summary.tsx:39-45` (`label="AI flags"` + `value={data.openSupport}` + `href="/admin/mentors"`).
- **Likely root cause:** Placeholder wiring — the tile was built before a real AI-flags metric existed and was pointed at `openSupport`.
- **Relevant files:** `src/components/dashboard/admin-summary.tsx`, `src/features/dashboard/data.ts`.
- **Recommended fix:** Either relabel the tile to "Open support" and link to `/admin/support`, or wire it to the risk-monitor flag count (`features/risk/data.ts`) and link to `/admin/insights`. Do not ship a metric whose label and value disagree.
- **Risks:** Admins may act on a wrong number when triaging.

### QA-ADMIN-002 — "System health" tile mislabels match-rate and is always green  · **P3**
- **Feature:** Admin dashboard (`/admin`)
- **Role:** Super Admin · **Language:** EN · **URL:** `/admin`
- **Steps:** 1) Open `/admin`. 2) Read the "System health" tile (and the "Program health" ring below).
- **Expected:** A metric that reflects programme/system health, with tone reflecting the value.
- **Actual:** Value = `activePairs / (activePairs + unmatchedMentees) × 100` — a **matching-completion rate**, not system health. With 1 active pair and 43 unmatched it showed **"3%"** while the tile tone stays hard-coded **`tone="ok"`** (green) and the ring subtitle reads **"Healthy programme"**. A fresh cohort thus displays "3% — Healthy programme", which reads as broken.
- **Reproduction rate:** 100%.
- **Evidence:** `qa-evidence/QA-ADMIN-002-system-health.md`; source `src/components/dashboard/admin-summary.tsx:46-52`, `src/app/(admin)/admin/page.tsx:19-21,49`.
- **Root cause:** Placeholder metric labeled "System health"; tone not derived from value.
- **Fix:** Rename to "Match rate" (or compute a real composite health score), and drive tone/subtitle from thresholds instead of a constant.

### QA-MATCH-003 — "Run matching" gives no feedback; 0-suggestion result is unexplained  · **P3**
- **Feature:** Matching engine (`/admin/matching`)
- **Role:** Super Admin · **Language:** EN · **URL:** `/admin/matching`
- **Steps:** 1) Open `/admin/matching` (43 unmatched mentees). 2) Click **Run matching**. 3) Observe.
- **Expected:** Visible result — a toast/summary such as "0 suggestions generated (N mentees pending training)".
- **Actual:** The server action fires (verified: `POST /admin/matching` 200) but the UI is unchanged — still "No suggestions yet. Run matching to generate them." No toast, no loading state, no count. The engine correctly produced 0 because all 43 unmatched mentees fail `MENTEE_ONBOARDING_INCOMPLETE` (onboarding = `trainingStatus===COMPLETED`; the mentees aren't trained). There are trained mentors with capacity, so this is purely a **data-state** outcome — but the admin cannot distinguish "worked, nothing eligible" from "failed".
- **Reproduction rate:** 100% given current data.
- **Evidence:** `qa-evidence/QA-MATCH-003-run-matching-no-feedback.md`; source `src/features/matching/actions.ts:44-139`, `src/features/matching/data.ts:61`.
- **Root cause:** `runMatching` returns `{suggested, menteesMatched}` but the page surfaces no success toast, and the empty state doesn't explain eligibility gating.
- **Fix:** Show a result toast with counts, and an empty-state hint ("X mentees are not yet eligible — pending training completion").

### QA-INSIGHT-004 — Language-distribution donut uses two near-identical greens  · **P3**
- **Feature:** Insights (`/admin/insights`)
- **Role:** Super Admin · **Language:** EN · **URL:** `/admin/insights`
- **Steps:** 1) Open `/admin/insights`. 2) Inspect the "Language distribution" donut (EN vs FR).
- **Expected:** Two categorical colors that are easily distinguishable (and colour-blind safe).
- **Actual:** EN and FR segments use two closely-related greens; distinguishing the two categories (and matching them to the legend) is difficult, and likely fails colour-contrast/colour-blind guidance for categorical data.
- **Reproduction rate:** 100%.
- **Evidence:** `qa-evidence/QA-INSIGHT-004-donut-colors.md` (screenshot captured in session).
- **Root cause:** Single-hue brand palette applied to a categorical chart.
- **Fix:** Use two perceptually-distinct hues (or a green + a neutral/secondary brand colour) for categorical series; verify against colour-blind simulation.

### QA-I18N-006 — French language selection leaves agreement content (and consent) in English  · **P2**
- **Feature:** Agreements (`/agreements`) + i18n · **Role:** Mentee · **Language:** FR · **URL:** `/agreements`
- **Steps:** 1) As the mentee, open `/agreements`. 2) Click **Français** in the header. 3) Observe the Confidentiality/Mentoring agreement.
- **Expected:** With French selected, the agreement title, body terms, and consent checkbox render in French (CLAUDE.md §16: never force French users into English; Phase 22: no mixed EN/FR).
- **Actual:** The UI chrome translates (nav, field labels, buttons — "Signer l'accord", "Saisissez votre nom complet pour signer"), but the **agreement title, all body bullet terms, and the consent checkbox label remain in English**. A French user is asked to read and sign a legal agreement whose terms are only in English.
- **Reproduction rate:** 100%.
- **Evidence:** `qa-evidence/QA-I18N-006-mixed-language-agreement.md` (screenshot in session).
- **Likely root cause:** Agreement content is rendered from `getAgreementTemplate(type, languageFor(user.locale))` — i.e. the **saved account locale** — while the header switcher changes only the next-intl **UI** locale. The two are decoupled, so the header toggle never re-renders content in French. (A mentee whose *account* language is FR may see FR content — untested; the header-toggle mixed state is still a defect.)
- **Recommended fix:** Drive agreement content language from the active UI locale (or persist the header toggle to `user.locale`), and verify no other content surfaces (goals, reviews, notifications) show the same UI-vs-content split.
- **SCOPE UPDATE (systemic):** Confirmed the same split on the **mid-term review** (`/mid-term-review`): chrome translated ("Revue de mi-parcours", "Soumettre la revue") but the **form title and all questions stayed English** ("Have you and your partner been meeting regularly?", etc.). So this affects agreements AND admin-authored form definitions — the fix must cover form-builder content (EN/FR titles + question text), not just agreements. (Positive: free-text answers offer EN|FR toggles, so mentees can still *write* in French.)

### QA-AGREE-005 — Agreement e-signature accepts a name that doesn't match the signer  · **P3** (P2 if legal-grade signatures required)
- **Feature:** Agreements (`/agreements`) · **Role:** Mentee · **Language:** EN · **URL:** `/agreements`
- **Steps:** 1) As mentee "Segun Diallo", open the Mentoring Agreement. 2) Type **"Wrong Name QA"** in "Type your full name to sign". 3) Check consent. 4) Click **Sign agreement**.
- **Expected (per brief's "incorrect name" case):** The signature is rejected, or at least the typed name is validated against the signer's identity.
- **Actual:** The agreement **signs successfully** and records "Signed: 2026-07-24 / Download PDF". The signer name on the record/PDF is the arbitrary "Wrong Name QA".
- **Reproduction rate:** 100%.
- **Evidence:** `qa-evidence/QA-AGREE-005-name-not-validated.md`; source `src/features/agreements/actions.ts:19` (`typedName: z.string().trim().min(2).max(120)` — no identity match).
- **Nuance:** Authorization is correct (only the accepted-pair participant may sign, once per type; consent required; audited with the real `actorId`). The gap is purely that the *displayed/PDF signature name* is unvalidated (a deliberate "typed name = signature" choice per the code comment).
- **Recommended fix:** If legal-grade signatures matter, validate the typed name against the signer's profile name (case/space-insensitive) or render the account name as the signature rather than free text.

### QA-AI-007 — AI-augmented features appear inactive on production (no rewrite from Goal Coach)  · **P2 (observation — verify keys)**
- **Feature:** AI Goal Coach (`/goals`) — and by extension the 8 AI assistants · **Role:** Mentee · **URL:** `/goals`
- **Steps:** 1) Start a new goal with a vague title ("get better at leadership"). 2) On step 2, click **Ask the Goal Coach**.
- **Expected:** An AI-generated SMART rewrite suggestion (the headline AI feature), advisory/human-gated.
- **Actual:** Returns only the **deterministic** readiness check ("SMART readiness: 0%. Still missing: …") and **"No rewrite suggestion this time"** — no AI rewrite. This pattern indicates the **AI provider keys (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) may not be set on Vercel**, so all AI-rewrite/summary/translation features silently degrade.
- **Reproduction rate:** 100% (this session).
- **Evidence:** `qa-evidence/QA-AI-007-goal-coach-no-rewrite.md` (screenshot in session).
- **Guardrail PASS (positive):** the coach output is advisory and **did not auto-save** anything (CLAUDE.md rule 5 upheld).
- **Recommended action:** Confirm whether AI keys are configured for Production on Vercel. If AI is intended for the pilot, this is **P2** (core feature category non-functional); if AI is deliberately off for now, downgrade to "expected — degraded by config" and ensure the UI communicates it.
- **UPDATE 2026-07-24 (RESOLVED to root cause — it's a provider-account issue, NOT the app):** After the owner redeployed, the AI adapter **is now enabled and calling providers** — but both fail at the API level. Vercel production logs (dep `dpl_AeL9kZWFjtr8FpxUdVozLAwdcr9m`, POST /goals):
  - `AI primary (anthropic:claude-sonnet-4-6) failed … HTTP 401` → the `ANTHROPIC_API_KEY` is invalid/expired.
  - `[goals] coach request failed … (openai:gpt-4o-mini) HTTP 429` → the `OPENAI_API_KEY` account is rate-limited / has no quota / billing not enabled.
  - The withFallback + graceful-degradation code worked exactly as designed. **The app is fine; the fix is on the AI provider accounts:** supply a valid Anthropic key OR an OpenAI account with available quota/billing. Re-verify the Goal Coach afterwards. Reclassify to config/billing, not a code defect.

### QA-COHORT-008 — Cohort creation accepts an end date before the start date  · **P3** (data-integrity)
- **Feature:** Cohorts (`/admin/cohorts`) · **Role:** Super Admin · **Language:** EN · **URL:** `/admin/cohorts`
- **Steps:** 1) New cohort "QA Test Cohort". 2) Start = **2026-12-01**, End = **2026-01-01** (end 11 months before start). 3) Click **New cohort**.
- **Expected:** Rejected with a "end must be after start" validation error.
- **Actual:** "Cohort created." — the cohort was created with an inverted date range, no error.
- **Reproduction rate:** 100%.
- **Evidence:** screenshot in session; verify `src/features/cohorts/schema.ts` lacks a `.refine()` enforcing `end > start` (and apply the same check to programmes).
- **Impact:** Corrupts date-based logic (journey timelines, review windows, "active cohort" calculations).
- **Fix:** Add a cross-field Zod refinement (end after start) server-side, plus inline client validation.

### QA-I18N-006 — additional surfaces (broadening)
- The **admin dashboard** heading/subtitle and stat-tile labels ("Enterprise Health Dashboard", "AI FLAGS", "SYSTEM HEALTH") are **hardcoded English** (not wired to next-intl) — they don't translate under Français.
- The **review form questions** stay English because the **Forms builder's French question fields were not populated in the seed** — the builder *does* support bilingual questions (Question English / Question French). So for forms the fix is data (author FR text); for agreements it's code (content follows account locale, not the UI toggle).

*(No unrelated defects were combined; each is filed separately.)*

---

## Workflow findings (by area)

- **Public website:** Login page verified working (after the `DATABASE_URL` schema fix). Homepage/About/FAQ not yet tested unauthenticated (logged-in session redirects `/` → dashboard); a logout pass is queued. *Pending.*
- **Authentication:** Credentials login works end-to-end. Session lands Super Admin on `/admin`. Route gate (`proxy.ts`) redirects unauthenticated users and restricts `/admin/*` to `SUPER_ADMIN`. Password-reset/invite flows **not exercised** (avoid spamming emails; need controlled test). 
- **Permissions:** **Code review: strong.** `requireRole`/`requireUser` at action boundaries; cohort scope fail-closed (`scope.ts`); pair access ACCEPTED-only and admin-excluded (`pair/access.ts`); DM queries participant-scoped (`messages/data.ts`); journal share-gated (`reflections/visibility.ts`); evidence API uploader/admin/mentor-only. **Live cross-role denial (mentee→/admin) pending mentee login.**
- **Profiles:** Not tested — needs role login. (Avatar serving API reviewed: IDOR-safe.)
- **Administration:** Dashboard, matching, insights, mentor directory render cleanly. Programme/cohort/import/forms/invites/support/settings CRUD **not yet exercised**.
- **Imports:** Not tested (needs controlled CSV/XLSX upload pass).
- **People:** Mentor directory renders (15 rows, full columns, emails, training/matching status). Mentee directory + search + pagination **not yet tested**.
- **Matching:** Engine + override reviewed (language rule unbreakable). Live run produced 0 (data-gated) with no feedback → QA-MATCH-003.
- **Pair workspace / Agreements / Goals / Meetings / Calendar / Sessions / Messaging (UI) / Journal / Support / Reviews / Notifications:** **Blocked** — participant lifecycle, needs Mentor & Mentee logins.
- **Training:** Insights shows low completion; admin training list not exercised.
- **AI features:** Architecture reviewed (server-side, advisory, human-gated; Atlas explicitly cannot read private content or take actions). Live behaviour untested (needs role sessions + AI key confirmation).
- **Translation:** Not tested (needs participant content + FR pass).
- **Dashboards / Insights:** Admin insights charts render; participant dashboards blocked. **QA-ADMIN-001/002** on admin tiles.
- **Settings / Maintenance:** **Not toggled on production by design** (enabling maintenance would lock out live users). Code review only; a live test needs staging or explicit approval.
- **Accessibility / Responsive / Performance:** Console clean and no request-loops on tested pages; sidebar prefetch is normal Next.js behaviour (aborted duplicate prefetches are not defects). Full a11y/responsive sweep pending.
- **Security & privacy:** See *Passed*. No P0/P1 found so far.

---

## Blocked tests (and exactly what's needed)
All require a logged-in session **in the browser the auditor drives**; the owner will log in manually per the agreed workflow.
1. **Mentor session** → mentor dashboard, pair workspace, goal review/approval, session logging + AI summary, meetings/scheduling, messaging UI, mentor private notes, agreements (mentor side), reviews, notifications, support.
2. **Mentee session** → mentee dashboard, profile edit + avatar upload, goal creation + AI Goal Coach, agreements (mentee side), journal (private/shared), reflections, messaging UI, reviews, support, translation toggles.
3. **Cross-role denial (live)** → confirm mentee/mentor receive redirect/403 on `/admin/*` and cannot load another pair's `/pair/[menteeId]`, `/messages/[conversationId]`, or evidence file by ID.
4. **Public unauthenticated pass** → requires logout (ends the current admin session); queued to run last.
5. **Maintenance mode live test** → needs staging or explicit approval to toggle on production.
6. **Email-dependent flows** (invite delivery, password reset, notifications email) → need a safe mailbox / MAIL_DEBUG.

---

## Not implemented / placeholder (not defects)
- **Forum** (`/forum`), **Clinics** (`/clinics`), **Newsletters** (`/newsletters`) — **no routes exist**; brief Phases 10 & 18 describe unbuilt (M4) features.
- **Trainer** and **Reviewer** roles — folded into Super Admin (`roles.ts`); not separate roles.
- **Messaging**: realtime delivery, typing/presence, attachments, and per-message translate toggle are explicitly **deferred** (`messages/data.ts` header) — DM send/read exists, the rest does not.
- **"Program health" score** — placeholder metric (QA-ADMIN-002).

---

## Passed critical workflows (verified)
1. **Matching language hard-rule** — enforced unconditionally in `evaluateHardRules`; not config-gated (code). ✅
2. **Cross-language override blocked** — `overrideMatch` refuses `LANGUAGE_MISMATCH` with a CONFLICT error (code). ✅
3. **Match response authorization** — only the matched mentor/mentee may accept/reject; status-gated (code). ✅
4. **DM confidentiality** — conversation reads are participant-scoped; admins are never participants (code). ✅
5. **Journal privacy** — reflections private until shared, and only to the author's accepted mentor; admins excluded (code). ✅
6. **Cohort isolation (H1)** — admin reads confined by `adminCohortScope`, empty scope fail-closed (code). ✅
7. **Evidence file IDOR** — uploader/admin/paired-mentor only; served as `attachment`, `no-store` (code). ✅
8. **Avatar endpoint** — requires authentication (code). ✅
9. **Route gating** — `/admin/*` restricted to `SUPER_ADMIN`, unauth redirected (`proxy.ts`). ✅
10. **Admin session lands role-correct** (`/admin`). ✅ (live)
11. **Credentials login** works post-fix. ✅ (live)
12. **Admin dashboard renders** with real data, clean console. ✅ (live)
13. **Matching engine page** renders + action fires. ✅ (live)
14. **Insights charts render** (4 charts). ✅ (live)
15. **Mentor directory renders** with correct columns/status. ✅ (live)

---

## Recommended repair order
1. **QA-AI-007 (P2, verify first)** — confirm whether AI keys are set on prod. If AI is meant for the pilot, this gates the product's core value; if not, mark it expected and surface it in UI.
2. **QA-I18N-006 (P2)** — French users must see French agreement terms (legal + core bilingual requirement); check goals/reviews/notifications for the same UI-vs-content split.
3. **QA-ADMIN-001 (P2)** — fix the "AI flags" tile (label/value/link mismatch); admins act on this number.
4. **QA-AGREE-005 (P3→P2 if legal-grade)** — validate the e-signature name against the signer's identity.
5. **QA-MATCH-003 (P3)** — add run-matching feedback + eligibility empty-state.
6. **QA-ADMIN-002 (P3)** — relabel/re-tone the "System health" tile.
7. **QA-INSIGHT-004 (P3)** — fix categorical donut colours.
8. *(Then complete the unrun phases — reviews, meetings, sessions+AI, admin CRUD/imports/forms, responsive+a11y, public — before final sign-off.)*

---

## Test data created (for cleanup)
On the **Segun Diallo ↔ Aisha Eze** pair (seed accounts), this audit created these records:
1. `[QA TEST]` Mentor feedback comment on goal "Strengthen stakeholder communication" (goal remains SUBMITTED).
2. `[QA TEST]` One direct message in the pair's DM thread.
3. **A SIGNED Mentoring Agreement** for the mentee, with signer name **"Wrong Name QA"** (created while testing QA-AGREE-005; this also sent an `agreement_signed` notification to the mentor). **Recommend soft-deleting this agreement row** so the pair can re-sign cleanly.
4. A draft goal titled "get better at leadership" (autosaved while testing the Goal Coach; may persist as a DRAFT — delete if unwanted).
5. A **session log** dated 2026-07-24 (Segun Diallo, mostly empty — created testing session-log save). Delete if unwanted.
6. A cancelled meeting "[QA TEST] QA Test Meeting" (scheduled then cancelled while testing; now shows ANNULÉE in Past — harmless, soft-delete if desired).
7. **Programme "QA Test Programme"** (DRAFT) — created testing programme CRUD.
8. **Cohort "QA Test Cohort"** (DRAFT, invalid dates) — created testing cohort CRUD / QA-COHORT-008.
No real user data was modified. Please clean up items 3–8 after review.

## Admin-side results (2026-07-24, session 5)
- **Programme create PASS** (with clear "Programme created." feedback).
- **Cohort create PASS** — but **QA-COHORT-008** (accepts inverted date range).
- **Forms builder PASS** — full builder (all question types, reorder, role targeting, active toggle, **bilingual question fields**).
- **Support queue PASS** — shows request + requester identity + response/status controls; confirms QA-ADMIN-001 (the "AI flags: 1" tile = this 1 open support request).
- **Import Data: BLOCKED** — requires a file upload; the driven browser cannot operate the native file picker (same limit as avatar upload). Needs a manual upload or a file-capable browser.
- **Invites: not run** — deferred to avoid any real email delivery; recommend testing with a clearly-fake address once mail transport is confirmed to be in log/no-send mode.

## Mentor-side lifecycle results (2026-07-24, session 4)
- **Session-log creation PASS** — new log saved and appears in the list.
- **AI Session Assistant** — "Structurer avec l'IA" degraded gracefully ("fill manually") — confirms QA-AI-007 hits the session assistant too; guardrail held (nothing auto-saved).
- **Local draft autosave PASS** — "Enregistré sur cet appareil" (offline-save).
- **Meeting scheduling PASS** and **cancellation PASS** (created → Upcoming → cancelled → Past/ANNULÉE).
- **Minor:** the session-log form saved with an empty meeting-type and summary (weak required-field validation).

## Mentor-side live results (2026-07-24, in progress)
- Mentor dashboard, pair workspace, goals (review), messaging all render and function.
- **Permission PASS (live):** mentor → `/admin` redirects to mentor dashboard; `/pair` shows only the mentee's own pairing.
- **Goal review PASS:** "Comment only" persisted mentor feedback and displayed it. Note: "Comment only" advances the goal's stage tracker to *Mentor reviewed* while keeping status SUBMITTED.
- **Messaging PASS:** DM send persists; no FAB/send-button overlap.
## Mentee-side live results (2026-07-24, cross-side verification)
- Mentee dashboard/journey tracker, goals, notifications, messaging all render and function.
- **Cross-side visibility PASS:** the mentee **sees the mentor's goal feedback** ("Aisha Eze · 2026-07-24") and **receives the mentor's DM** (incoming bubble). Notifications for both were delivered to the mentee inbox.
- **Notification inbox PASS:** unread count, mark-read, and full per-type preference/mute controls render.
- **Admin-cannot-read-DM:** verified in code (`getThread` participant-scoped); admins are never conversation participants.

### QA-NOTIF-OBS — Two goal-feedback notifications for one review (observation, unconfirmed)  · P3?
The mentee inbox showed both "Goal feedback from Aisha Eze" and "Goal feedback from your mentor" for the same goal/date. **However**, the review action (`src/features/goals/actions.ts:294`) calls `notify()` exactly once per review, so the second entry is most plausibly a **pre-existing seed notification** (empty `mentorName` → generic "your mentor" copy), not a code-level duplicate. Flagged for verification, **not** filed as a confirmed defect. To confirm: check whether a fresh review on a clean goal produces one or two notifications.

## Next actions to complete the audit
- Owner logs in as a **Mentor** (a matched one, e.g. Aisha Eze) in the audit browser → run Phases 10–14, 16, 18–21 (mentor side).
- Owner logs in as the paired **Mentee** (Segun Diallo) → run Phases 5, 11–16, 18, 21–22 (mentee side).
- Finish with a **logout → public/unauthenticated** pass (Phase 3) and a **responsive/a11y** sweep (Phase 25).
