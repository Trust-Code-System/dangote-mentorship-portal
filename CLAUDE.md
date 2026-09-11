# Dangote Mentorship Portal — Master Build Prompt

> \\\*\\\*How to use this file.\\\*\\\* Save it as `CLAUDE.md` (or `/docs/SPEC.md`) at the root of the repo and treat it as the project constitution. Do \\\*\\\*not\\\*\\\* ask the model to build everything in one shot. Run it milestone by milestone: paste the relevant milestone section as your active task, let the model complete it to its Definition of Done, review, then advance. The model should always re-read this file before starting a milestone.

\---

## 0\. Role and operating instructions

You are a **senior full-stack engineer and enterprise SaaS architect** specializing in HR-tech and learning-management systems, bilingual (English/French) products, AI-augmented workflows, and security-conscious internal portals. You write production-grade, typed, tested code. You are building an internal mentorship operating system for Dangote Group, a large African industrial conglomerate.

Operating rules, in priority order:

1. **Work in vertical slices, milestone by milestone.** Complete one milestone to its Definition of Done before touching the next. Never scaffold empty modules for later milestones.
2. **The data model is the spine.** Implement the schema in Milestone 0 exactly as specified. Schema changes after M0 require an explicit migration and a one-line note in `CHANGELOG.md`.
3. **Ask before assuming on irreversible or ambiguous decisions** (auth provider config, data retention, admin visibility into private messages, destructive migrations). For everything else, make a reasonable choice, state it inline in a code comment, and proceed. Bias toward shipping.
4. **Test the matching engine and the validation engine.** These two are non-negotiable for unit tests with golden cases. Everything else gets at least a smoke test.
5. **AI never writes to the database without explicit human approval.** AI proposes; a human (admin/mentor) commits. This applies to matching, goal approval, and newsletter sends without exception.
6. **Translation is cross-cutting.** Never force a French-speaking user to write in English. Store original text and translated text separately.
7. **Confidentiality is real.** Direct messages between a mentor and mentee are private. Admins see activity *metadata* (last-active, message count, cadence) for the engagement monitor, never message content, unless an explicit, logged admin-override policy is configured.
8. Prefer **server actions / typed RPC** over ad-hoc REST where the framework allows. Validate every input with Zod at the boundary.
9. Keep the code **readable and conventional**. No clever one-liners. Named functions, small components, colocated types.

When you finish a milestone, output: (a) what you built, (b) how to run/test it, (c) any decisions you made under rule 3, (d) what's deferred to a later milestone.

\---

## 1\. Product context

A **9-month bilingual mentorship programme portal** that takes Dangote from manual, document-based mentorship management to an intelligent, measurable, AI-assisted system. The journey: **Pre-training \& matching → Training → Goal setting → Mentorship sessions → Reviews → Clinics → Reporting → Completion.**

Two operating phases:

* **Phase 1 (Pre-training \& matching):** import mentor/mentee data, validate it, run the matching engine, admin reviews and approves pairings, run training batches.
* **Phase 2 (Active mentorship):** agreements, goals, session logs, scheduling, mid/end reviews, clinics, newsletters, forum, messaging, translation, reporting.

Six roles: **Super Admin, Programme Admin, Mentor, Mentee, Trainer/Facilitator, Reviewer/HR-L\&D Executive.**

The product is multi-cohort: Dangote runs a fresh programme each year (e.g. "Dangote Mentorship Programme 2026", Jan–Sep, EN + FR, \~120 mentors / \~300 mentees, training batches A/B/C). Every record is scoped to a cohort.

\---

## 2\. Tech stack (locked)

Use current stable versions; do not pin to numbers in this doc.

* **Frontend:** Next.js (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui, Framer Motion (sparingly), React Hook Form + Zod.
* **Backend:** Next.js server actions + route handlers. PostgreSQL via Prisma. Supabase for Postgres + Auth + Storage + Realtime (or self-hosted Postgres if Dangote requires on-prem — keep the data layer behind a thin repository so this is swappable).
* **Auth:** Auth.js (NextAuth) with **Microsoft Entra ID (Azure AD) SSO** as the primary provider, email/password as fallback, admin-created accounts, and invite links. Role-based access control enforced server-side on every action.
* **AI:** A **provider-agnostic adapter** (`lib/ai/`) exposing `complete()`, `translate()`, `summarize()`, `score()`. Default implementation targets the Anthropic Messages API; the adapter must allow swapping to Azure OpenAI without touching feature code. All AI calls are server-side only. Never expose keys to the client.
* **Realtime:** Supabase Realtime (or socket layer) for messaging presence, typing, and forum live updates.
* **i18n:** `next-intl` for UI strings (en, fr). Content translation goes through the AI `translate()` adapter and is persisted.
* **Email/Notifications:** Resend or Microsoft Graph mail. Optional WhatsApp Business API behind a feature flag.
* **Calendar/Meetings:** Zoom API, plus Microsoft Outlook / Google Calendar. Wire these in M5; abstract behind a `MeetingProvider` interface from the start.
* **Charts/Export:** Recharts; PDF export via a server-side renderer; Excel export via SheetJS.
* **Testing:** Vitest + Testing Library; Playwright for one happy-path E2E per milestone.
* **Tooling:** ESLint, Prettier, Husky pre-commit, GitHub Actions CI (typecheck + lint + test).

\---

## 3\. Architecture \& conventions

* App Router with route groups: `(public)`, `(auth)`, `(dashboard)`, `(admin)`. Role gating in `middleware.ts` plus a server-side `requireRole()` guard in every action.
* Folder layout: `app/`, `components/`, `features/<feature>/` (each feature owns its actions, schema, components), `lib/` (ai, db, auth, i18n, mail, meetings, utils), `prisma/`, `tests/`.
* Every mutation is a typed server action that: authenticates → authorizes (`requireRole`) → validates (Zod) → executes → writes an `audit\\\_logs` row → returns a typed result.
* Soft-delete (`deleted\\\_at`) on all primary entities. Never hard-delete user-generated content.
* All timestamps UTC; render in user timezone.
* Feature flags via a simple `feature\\\_flags` table so integrations can ship dark.
* Seed a realistic **bilingual demo cohort** (≥ 15 mentors, ≥ 30 mentees, mix of EN/FR, varied departments/competencies, a few intentionally messy rows for the validator to catch) so every feature is demoable immediately.

\---

## 4\. RBAC matrix (enforce server-side)

|Capability|Super Admin|Prog. Admin|Mentor|Mentee|Trainer|Reviewer|
|-|-|-|-|-|-|-|
|Manage platform/cohorts|✅|partial|—|—|—|—|
|Import data, run matching|✅|✅|—|—|—|—|
|Approve/override matches|✅|✅|accept/reject own|accept/confirm own|—|—|
|Manage training batches|✅|✅|view own|view own|✅|—|
|Submit/approve goals|✅ view|✅ view|approve mentee's|submit own|—|—|
|Session logs|✅ view|✅ view|create/edit own|reflect on own|—|—|
|Mid/end reviews|✅ view|✅ view|complete own|complete own|—|view aggregate|
|Clinics \& newsletters|✅|✅|participate|participate|host|—|
|Forum|moderate|moderate|post|post|post|view|
|Direct messages|metadata only|metadata only|own threads|own threads|own threads|—|
|Reports \& analytics|✅|✅|own pairs|own progress|own batches|✅ programme-wide|
|User management, audit logs|✅|partial|—|—|—|—|

"metadata only" = activity counts/cadence for the engagement monitor, never message content.

\---

## 5\. Data model

Implement in Prisma. Names are guidance; keep them consistent. Add `id`, `created\\\_at`, `updated\\\_at`, `deleted\\\_at` to every table and `cohort\\\_id` to every cohort-scoped table.

**Core / identity:** `users`, `roles`, `user\\\_roles`, `programmes`, `cohorts`, `feature\\\_flags`, `audit\\\_logs`, `notifications`.

**Profiles:** `mentor\\\_profiles`, `mentee\\\_profiles` (fields per §6), `competencies` (taxonomy: general vs technical), `profile\\\_competencies`.

**Intake \& matching:** `imports` (file metadata, status), `import\\\_rows` (raw + validation result), `matching\\\_criteria` (per-cohort weights + hard rules), `matches` (mentor\_id, mentee\_id, score, status: suggested/admin\_approved/accepted/rejected/overridden, ai\_rationale, accepted\_at).

**Training:** `training\\\_batches`, `training\\\_attendance`, `training\\\_materials`, `training\\\_assessments`.

**Mentorship loop:** `agreements` (type: mentoring|confidentiality, signed\_by, signed\_at, pdf\_url, terms\_json), `goals` (SMART fields per §7, status, mentor\_comments), `goal\\\_reviews`, `meetings` (type, recurrence, provider, join\_url, status), `session\\\_logs` (fields per §6.9, ai\_summary, mentee\_reflection), `action\\\_items` (linked to session/goal, due, status).

**Reviews:** `midterm\\\_reviews`, `final\\\_reviews` (role-specific question sets stored as `form\\\_definitions` + `form\\\_responses` so admins can edit forms without code changes).

**Engagement:** `clinics`, `clinic\\\_rsvps`, `clinic\\\_questions` (with `is\\\_anonymous`), `clinic\\\_summaries`, `newsletters`, `newsletter\\\_recipients`, `resources`.

**Forum (new):** `forum\\\_categories` (cohort-scoped, e.g. General, Goal-setting, French-speaking corner, Success stories, Q\&A), `forum\\\_threads` (title, category, author, is\_anonymous, is\_pinned, is\_locked), `forum\\\_posts` (thread\_id, author, body\_original, body\_lang, body\_translated, body\_translated\_lang), `forum\\\_reactions`, `forum\\\_reports` (moderation queue).

**Messaging (new):** `conversations` (cohort-scoped; type: direct|group; default direct = matched pair), `conversation\\\_participants`, `messages` (conversation\_id, sender\_id, body\_original, body\_lang, body\_translated, attachment\_id?), `message\\\_reads` (per-participant read cursor), `message\\\_attachments`. Real-time delivery via Realtime channels keyed by conversation\_id.

**Translation:** `translations` (entity\_type, entity\_id, source\_lang, target\_lang, source\_text, translated\_text, model) — cache so the same content is never re-translated.

\---

## 6\. Profiles \& session log fields

**Mentor profile:** full name, email, phone, department, job title, location, **preferred language (EN/FR)**, years of experience, current role, previous roles, why they want to mentor, general competencies, technical competencies, personality, what mentees can learn from them, interests/hobbies, availability, **max mentees (capacity)**, training status, matching status.

**Mentee profile:** full name, email, phone, department, job title, location, **preferred language (EN/FR)**, current grade, previous positions, why they want a mentor, strongest competencies, **competencies to strengthen**, career goals, personality, interests/hobbies, training status, matching status.

**Session log:** date, time, meeting type (Zoom/physical/phone/Teams/Meet), competency discussed, goal discussed, discussion summary, actions agreed, challenges raised, resources needed, next action plan, timeline, next meeting date, mentor notes, mentee reflection, attachments, **AI-generated summary**.

\---

## 7\. Goal setting (SMART)

Goal form: title, competency to develop, why it matters, current level, desired level, learning activity, start date, end date, success measure, evidence of progress, mentor comments, mentor approval, admin visibility. The **AI Goal Coach** rewrites vague goals into SMART form (Specific, Measurable, Achievable, Results-oriented, Time-based) as a *suggestion* the mentee accepts or edits; the mentor then approves, edits, or comments. Approval is a human action that flips goal status.

\---

## 8\. The matching engine (build first, test hardest)

Implement as a **pure function** `scoreMatch(mentor, mentee, criteria): MatchResult` with no I/O, fully unit-tested.

**Layer 1 — hard rules (must never break):**

* Language must match exactly (EN↔EN, FR↔FR). This is the single most important rule — write explicit tests asserting cross-language pairs are *impossible*.
* Mentor has remaining capacity.
* Same active cohort.
* Mentor completed required training; mentee completed onboarding.
* Optional, cohort-configurable: not same reporting line; no flagged conflict of interest; mentor available.

**Layer 2 — weighted scoring (defaults, admin-tunable per cohort):** competency match 30, career-goal alignment 25, experience relevance 20, department/function relevance 10, availability 10, personality compatibility 5. Output 0–100.

The engine returns: score, a human-readable **AI rationale** ("Same language: English. Mentor has 15 yrs leadership/ops; mentee wants leadership + stakeholder management; availability aligns."), and any flags. Admin sees ranked suggestions, can override, and every override is audited. AI explains; the admin decides.

\---

## 9\. AI features (eight assistants, all server-side, all human-gated where they write)

1. **Matching Assistant** — applies rules, scores, explains, flags weak/missing data, suggests alternatives. Output is advisory.
2. **Goal Coach** — vague → SMART, suggests measures and learning activities, links competencies. Suggestion only.
3. **Session Assistant** — summarizes notes, extracts action items, flags blockers, suggests next steps, drafts next agenda, translates notes.
4. **Review Assistant** — analyzes mid/final responses, summarizes progress, detects low engagement and at-risk pairs, drafts the programme report.
5. **Newsletter Assistant** — drafts weekly newsletters from real portal data; **admin must review before send**.
6. **Clinic Assistant** — groups submitted challenges (and forum threads) by theme, suggests topics, drafts agenda, summarizes the session.
7. **Translation Assistant** — professional EN↔FR for notes, goals, reviews, newsletters, forum posts, messages. Persist both versions via the `translations` cache.
8. **Risk \& Engagement Monitor** — flags pairs that haven't met, stale goals, missing logs, unsubmitted reviews, low-quality goals, inactive mentors, repeated challenges. Uses message/meeting **metadata only**, never message content.

\---

## 10\. Engagement features

**Monthly clinics:** calendar, topic of the month, Zoom link, RSVP, attendance, pre-clinic challenge submission, success-story submission, anonymous question option, discussion board, post-clinic AI summary + action points + auto-draft newsletter.

**Weekly newsletters:** AI-drafted from portal activity, admin-reviewed, bilingual, scheduled send, recipient tracking.

**Community Forum (new):** cohort-scoped categories; threads and threaded replies; reactions; role badges (mentor/mentee/admin); a **French-speaking corner** plus a per-post **"translate" toggle** that calls the translation adapter and caches the result; **anonymous post option** (mirrors the clinic anonymous question); search; moderation queue (pin/lock/remove/report) for admins; notifications on replies and mentions. The Clinic Assistant ingests forum threads when grouping challenges by theme.

**Instant messaging (new):** real-time 1:1 DMs, default-provisioned for each matched mentor–mentee pair; typing indicators, read receipts, presence; file/image attachments; per-message **translate toggle** (EN↔FR, cached); unread badge + email/push notification on unread; message search. **Confidentiality:** message content is private to participants. Admins and the Risk Monitor see only metadata (last-active, message count, cadence). Any content access requires an explicit, configurable, **logged admin-override policy** — implement the policy hook but default it OFF and confirm with the human before enabling. Group conversations (e.g. a clinic cohort channel) are optional behind a feature flag.

\---

## 11\. Intake \& validation

Accept Excel, CSV, Google Sheets connection, and Google Form response exports. On import: clean and validate, then surface AI-assisted, row-level flags — missing name/email/language/department/role/competency, invalid email, duplicates, empty experience, incomplete responses. Show a review screen where the admin fixes or accepts rows before they become profiles. Example flags the AI should phrase plainly: "This mentor has no language selected." / "This mentee has no career goal." / "These 5 participants appear duplicated." / "20 years' experience but no competency area selected."

\---

## 12\. Dashboards

* **Admin:** totals (mentors, mentees, matched, unmatched), training completion, goal submission/approval rates, session completion, mid/final review completion, active vs inactive pairs, upcoming meetings/clinics, newsletter status, language distribution, AI risk alerts.
* **Mentor:** assigned mentees, upcoming meetings, pending goal reviews, session logs, action plans, review forms, clinic schedule, resources, AI-suggested questions/agenda.
* **Mentee:** assigned mentor, goal form, approved goals, upcoming meetings, session logs, action items, review forms, clinic schedule, resources, AI goal coach.
* **Executive/Reviewer:** programme impact, participant counts, completion + engagement rates, skills being developed, common challenges, success stories, department + language participation, recommendations for next cohort.

\---

## 13\. Pages

**Public:** Home, About the Programme, Programme Structure, Mentor Guide, Mentee Guide, FAQ, Login.
**Authenticated:** Dashboard, Profile, Matching, My Mentor / My Mentee, Training, Goals, Mentoring Agreement, Confidentiality Agreement, Session Logs, Calendar, Zoom Sessions, Clinics, Forum, Messages, Newsletters, Mid-Term Review, Final Review, Resources, Reports, Settings.
**Admin:** Programme Setup, Cohorts, Import Data, Mentor List, Mentee List, Matching Engine, Training Batches, Forms Builder, Clinics, Newsletters, Forum Moderation, Reports, AI Insights, User Management, Audit Logs.

\---

## 14\. Non-functional requirements

* **Security:** server-side authz on every action; least privilege; CSRF-safe server actions; rate-limit AI and auth endpoints; secrets only in env; no PII in logs; OWASP Top 10 conscious. Treat all imported data as untrusted.
* **Privacy/compliance:** explicit data-retention policy per cohort; agreements and messages are confidential records; right-to-export and right-to-delete per user (soft-delete + scheduled purge).
* **Performance:** server components by default; paginate every list; cache translations; debounce realtime.
* **Accessibility:** WCAG 2.1 AA — keyboard nav, focus states, labels, contrast. Forms fully accessible.
* **i18n:** full EN/FR UI; user-selected interface language persisted; content translation cached.
* **Observability:** structured logs, error boundary + reporting, audit trail queryable by admins.

\---

## 15\. Milestone plan (build in this order)

* **M0 — Foundations:** schema, migrations, Auth.js + Entra SSO + email fallback + invite links, RBAC guards, cohort/programme CRUD, i18n scaffolding, seed bilingual demo cohort, CI green. *DoD:* a user of each role can log in and land on a role-correct (stub) dashboard; demo cohort exists; `requireRole` blocks unauthorized actions; tests pass.
* **M1 — Intake \& Matching:** import + validation + AI flags, mentor/mentee profiles, matching engine (pure, tested, language hard-rule proven) + AI rationale, admin review/override UI, accept/reject flow. *DoD:* import the demo sheet, run matching, see scored suggestions with explanations, approve pairs; cross-language match is provably impossible.
* **M2 — Mentorship loop:** digital mentoring + confidentiality agreements (e-sign + PDF), goal setting + AI Goal Coach + mentor approval, session logging + AI summary, meeting scheduler (provider-abstracted), email notifications. *DoD:* a matched pair can sign agreements, set/approve a SMART goal, log a session with AI summary, and schedule a meeting. **This is the pilot-ready MVP.** **Launch gate:** run the Production Readiness Audit (separate file) against this build; no unresolved Critical or High findings before the Dangote pilot, with cohort isolation/IDOR and the messaging confidentiality model scrutinized specifically.
* **M3 — Reviews \& health:** mid-term + final reviews (editable form definitions), AI Review Assistant, AI Risk Monitor, all four dashboards with real data. *DoD:* reviews complete and aggregate; dashboards reflect live state; risk alerts fire on the demo data.
* **M4 — Engagement:** clinics, AI newsletters (admin-reviewed), Community Forum, instant messaging, translation woven through forum/messages/notes. *DoD:* run a clinic end-to-end, draft+send a newsletter, hold a forum thread, exchange real-time DMs with translate + read receipts; confidentiality metadata-only is enforced.
* **M5 — Integrations \& launch:** Zoom + calendar live, WhatsApp flag, PDF/Excel exports, audit-log surfacing, pilot config, launch checklist. *DoD:* create/join a Zoom meeting from the portal, export a cohort report, full audit trail visible. **Launch gate:** run the full Production Readiness Audit with integrations live; zero unresolved Critical/High findings and a launch recommendation of at least `READY FOR PRODUCTION` before go-live.

\---

## 16\. Guardrails — what NOT to do

* Don't let AI commit matches, approve goals, or send newsletters automatically.
* Don't let admins read direct messages by default.
* Don't force French users into English anywhere.
* Don't hard-delete user content.
* Don't build later-milestone modules as empty stubs "to save time."
* Don't put AI keys, Zoom secrets, or SSO secrets anywhere near the client bundle.
* Don't skip the matching-engine and validation tests.

\---

## 17\. Definition of done (every feature)

## Typed end-to-end · Zod-validated inputs · server-side authz · audited mutations · empty/loading/error states · responsive + AA-accessible · EN/FR · at least a smoke test (matching/validation: full unit coverage) · seed data demonstrates it · a one-line entry in `CHANGELOG.md`.

18. Experience Layer
See docs/experience-layer.md. Tier 1 items are part of the M2–M4 Definitions of Done. Tier 2 and Tier 3 are out of scope until instructed.

## 19. Design System — See docs/design-system.md. This governs ALL UI. Build the token file and shared component library FIRST, before any feature screen. No raw shadcn defaults; every component is themed to these tokens.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
