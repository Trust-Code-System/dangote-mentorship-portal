# QA Test Matrix — BLAK MOH Mentorship Portal

Environment: Prod (`dangote-mentorship-portal.vercel.app`) + local source `main`@290842d · Date 2026-07-24
Status: `PASS` · `FAIL` · `BLOCKED` (needs role login) · `N/I` (not implemented) · `REVIEW` (code-review only)

| Test ID | Area | Test case | Role | Lang | Env | Expected | Actual | Status | Issue | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| T-AUTH-01 | Auth | Credentials login | Admin | EN | Prod | Lands role-correct dashboard | Lands `/admin` | PASS | — | session |
| T-AUTH-02 | Auth | Prod login after `schema=mentorship` fix | Admin | EN | Prod | Login succeeds | Succeeds | PASS | (env fix) | vercel logs |
| T-AUTH-03 | Auth | Unauthenticated → protected route | anon | — | Prod | Redirect to /login | (proxy gate) | REVIEW | — | proxy.ts |
| T-AUTH-04 | Auth | Password reset flow | anon | — | Prod | Reset email/token | not run (email) | BLOCKED | — | — |
| T-AUTH-05 | Auth | Invite accept / expired / reused | anon | — | Prod | Correct handling | not run | BLOCKED | — | — |
| T-PERM-01 | Permissions | `/admin/*` requires SUPER_ADMIN | Admin | — | Prod+code | Gated | Gated | PASS | — | proxy.ts |
| T-PERM-02 | Permissions | Mentee/Mentor denied `/admin` (live) | Mentee | — | Prod | 403/redirect | not run | BLOCKED | — | — |
| T-PERM-03 | Permissions | Cohort isolation (admin scope) | Admin | — | code | Fail-closed filter | Correct | REVIEW | — | scope.ts |
| T-PERM-04 | Permissions | Pair workspace access (ACCEPTED only, no admin) | any | — | code | Participant-only | Correct | REVIEW | — | pair/access.ts |
| T-PERM-05 | Permissions | DM read confined to participants | any | — | code | Participant-only | Correct | REVIEW | — | messages/data.ts |
| T-PERM-06 | Permissions | Journal private until shared; admin excluded | any | — | code | Share-gated | Correct | REVIEW | — | reflections/visibility.ts |
| T-PERM-07 | Permissions | Evidence file IDOR | any | — | code | uploader/admin/mentor only | Correct | REVIEW | — | evidence/route.ts |
| T-PERM-08 | Permissions | Avatar endpoint requires auth | any | — | code | 401 if anon | Correct | REVIEW | — | avatar/route.ts |
| T-MATCH-01 | Matching | Language hard-rule (EN≠FR impossible) | — | — | code | Cross-lang ineligible | Enforced unconditionally | PASS | — | engine.ts:236 |
| T-MATCH-02 | Matching | Override cannot cross language | Admin | — | code | Blocked w/ CONFLICT | Blocked | PASS | — | actions.ts:227 |
| T-MATCH-03 | Matching | Match accept/reject authz | Mentor/Mentee | — | code | Participant-only | Correct | REVIEW | — | actions.ts:306 |
| T-MATCH-04 | Matching | Run matching (live) | Admin | EN | Prod | Suggestions or clear empty | 0 suggestions, **no feedback** | FAIL | QA-MATCH-003 | evidence |
| T-MATCH-05 | Matching | Matching page renders + hard-rule banner | Admin | EN | Prod | Renders | Renders w/ banner | PASS | — | screenshot |
| T-ADMIN-01 | Dashboard | Admin dashboard renders | Admin | EN | Prod | Tiles + heatmap + health | Renders | PASS | — | screenshot |
| T-ADMIN-02 | Dashboard | "AI flags" tile value/label | Admin | EN | Prod | AI/risk flags | Shows openSupport count | FAIL | QA-ADMIN-001 | evidence |
| T-ADMIN-03 | Dashboard | "System health" tile | Admin | EN | Prod | Real health, toned | Match-rate mislabeled, always green | FAIL | QA-ADMIN-002 | evidence |
| T-ADMIN-04 | Insights | Insights charts render | Admin | EN | Prod | 4 charts | All render | PASS | — | page text |
| T-ADMIN-05 | Insights | Language donut categorical colours | Admin | EN | Prod | Distinct hues | Two near-identical greens | FAIL | QA-INSIGHT-004 | evidence |
| T-ADMIN-06 | People | Mentor directory renders | Admin | EN | Prod | Full columns | Renders (15 rows) | PASS | — | page text |
| T-ADMIN-07 | People | Mentee directory + pagination/search | Admin | EN | Prod | Paginated list | not run | BLOCKED* | — | — |
| T-ADMIN-08 | Admin | Programme/Cohort CRUD | Admin | EN | Prod | Create/edit/archive | not run | — | — | — |
| T-ADMIN-09 | Admin | Import CSV/XLSX workflow | Admin | EN | Prod | Validate→commit | not run | — | — | — |
| T-ADMIN-10 | Admin | Forms builder | Admin | EN | Prod | Build/activate | not run | — | — | — |
| T-ADMIN-11 | Admin | Invites create/revoke/expire | Admin | EN | Prod | Correct lifecycle | not run (email safety) | — | — | — |
| T-ADMIN-12 | Admin | Support queue | Admin | EN | Prod | Triage/respond | not run | — | — | — |
| T-SET-01 | Settings | Maintenance mode toggle | Admin | — | Prod | Lock non-admins | **not toggled on prod (safety)** | BLOCKED | — | code only |
| T-PERF-01 | Perf | Console errors / request loops (tested pages) | Admin | EN | Prod | None | None; normal prefetch | PASS | — | network |
| T-PERM-02 | Permissions | Mentor denied `/admin` (live) | Mentor | — | Prod | Redirect/deny | Redirected to mentor dashboard | PASS | — | screenshot |
| T-PERM-09 | Permissions | Pair page scoped to own pairing | Mentor | EN | Prod | Only Segun Diallo | Only Segun Diallo shown | PASS | — | screenshot |
| T-LIFE-01 | Dashboard | Mentor dashboard renders | Mentor | EN | Prod | Role-correct | Renders (match, tiles) | PASS | — | screenshot |
| T-LIFE-02 | Pair | Pair workspace loads | Mentor | EN | Prod | Contract + stats + tabs | Renders fully | PASS | — | page text |
| T-LIFE-03 | Goals | Mentor review — Comment only records feedback | Mentor | EN | Prod | Feedback saved + shown | Saved, shown under MENTOR FEEDBACK | PASS | — | screenshot |
| T-LIFE-04 | Goals | Goal stage after "Comment only" | Mentor | EN | Prod | (n/a) | Advances to "Mentor reviewed", status stays SUBMITTED | PASS (note) | obs | screenshot |
| T-LIFE-05 | Messaging | Send DM to paired mentee | Mentor | EN | Prod | Sends + persists | Outgoing bubble appears, composer clears | PASS | — | screenshot |
| T-LIFE-06 | Messaging | FAB vs Send-button overlap | Mentor | EN | Prod | No overlap | Send clickable, no overlap | PASS | — | read_page |
| T-LIFE-10 | Dashboard | Mentee dashboard / journey tracker renders | Mentee | EN | Prod | Role-correct | Renders (22% journey) | PASS | — | screenshot |
| T-LIFE-11 | Goals | Mentee SEES mentor feedback (cross-side) | Mentee | EN | Prod | Feedback visible | Visible ("Aisha Eze · 2026-07-24") | PASS | — | page text |
| T-LIFE-12 | Messaging | Mentee RECEIVES mentor DM (cross-side) | Mentee | EN | Prod | Message received | Incoming bubble shown | PASS | — | screenshot |
| T-NOTIF-01 | Notifications | Inbox + unread + preferences render | Mentee | EN | Prod | Inbox works | 3 unread, mark-read, per-type mute | PASS | — | page text |
| T-NOTIF-02 | Notifications | Goal-review notification delivered | Mentee | EN | Prod | 1 per review | 2 goal-feedback entries seen; code emits 1/review → likely seed+new, not a code dup | OBSERVE | QA-NOTIF-OBS | page text |
| T-LIFE-13 | Goals | Mentee goal-creation SMART stepper renders | Mentee | EN | Prod | Form + draft-save | Renders, "Draft saved" | PASS | — | page text |
| T-LIFE-XVERIFY | Privacy | Admin cannot read DM content (metadata only) | Admin | — | code | Excluded | getThread participant-scoped | REVIEW | — | messages/data.ts |
| T-LIFE-14 | Profile | Mentee profile edit + avatar upload | Mentee | EN | Prod | Save/upload | not run | — | — | — |
| T-LIFE-15 | Goals | AI Goal Coach (vague→SMART) | Mentee | EN/FR | Prod | Suggestion, human-gated | not run | — | — | — |
| T-LIFE-16 | Agreements | Confidentiality + mentoring e-sign (both sides) | Mentor+Mentee | EN | Prod | Sign + PDF | not run | — | — | — |
| T-LIFE-17 | Journal | Private vs shared reflection | Mentee | EN | Prod | Private hidden from mentor | not run (code REVIEW pass) | — | — | visibility.ts |
| T-LIFE-18 | Sessions | Session log + AI summary | Mentor | EN | Prod | Log + AI | not run | — | — | — |
| T-LIFE-19 | Meetings | Schedule meeting + status | Mentor+Mentee | EN | Prod | Create/join | not run | — | — | — |
| T-LIFE-20 | Reviews | Mid-term review form renders + validates | Mentee | FR | Prod | Renders/validates | Renders (not submitted) | PASS | QA-I18N-006 (questions EN) | page text |
| T-LIFE-21 | Goals | AI Goal Coach guardrail (no auto-save) | Mentee | EN/FR | Prod | Advisory only | Nothing saved | PASS | — | screenshot |
| T-LIFE-22 | Goals | AI Goal Coach returns AI rewrite | Mentee | EN/FR | Prod | SMART rewrite | No rewrite — providers 401/429 | FAIL(config) | QA-AI-007 | vercel logs |
| T-LIFE-23 | Agreements | E-sign accepts wrong name | Mentee | EN | Prod | Reject wrong name | Signed as "Wrong Name QA" | FAIL | QA-AGREE-005 | screenshot |
| T-I18N-01 | i18n | FR: agreement content | Mentee | FR | Prod | French terms | English terms | FAIL | QA-I18N-006 | screenshot |
| T-I18N-02 | i18n | FR: review form questions | Mentee | FR | Prod | French questions | English questions | FAIL | QA-I18N-006 | page text |
| T-I18N-03 | i18n | FR: goal stepper "Next step" button | Mentee | FR | Prod | Translated | Stays "Next step" | FAIL(minor) | QA-I18N-006 | screenshot |
| T-I18N-04 | i18n | FR: static UI (homepage/journal/nav/meetings/sessions) | all | FR | Prod | Translated | Fully translated | PASS | — | page text |
| T-LIFE-24 | Journal | Journal renders + privacy messaging | Mentee | FR | Prod | Private space | Renders, "Rien n'est partagé sans votre accord" | PASS | — | screenshot |
| T-LIFE-25 | Meetings | Schedule form + happened-confirm + lists | Mentee | FR | Prod | All render | All render/functional | PASS | — | page text |
| T-LIFE-26 | Sessions | Mentee sees shared summary, NOT mentor private notes | Mentee | FR | Prod | Shared only | Shared shown, private notes absent | PASS | — | page text |
| T-LIFE-27 | Sessions | Mentee updates own action item only | Mentee | FR | Prod | Own editable | Own dropdown, mentor's read-only | PASS | — | screenshot |
| T-PUB-01 | Public | Homepage renders (logged out) | anon | FR | Prod | Full page | Hero/stats/journey/cards/CTA all render | PASS | — | page text |
| T-PUB-02 | Public | FAQ renders | anon | FR | Prod | Q&A | Renders | PASS | — | page text |
| T-PUB-03 | Public | Language persists across logout | anon | FR | Prod | Persists | FR persisted | PASS | — | screenshot |
| T-STEP-01 | Goals | Goal stepper active-step indicator advances | Mentee | EN/FR | Prod | Advances | Stays on step 1 visually | FAIL(minor) | obs | screenshot |
| T-SESS-01 | Sessions | Mentor session-log create + save | Mentor | FR | Prod | Log saved | New 2026-07-24 log created | PASS | — | screenshot |
| T-SESS-02 | Sessions | AI Session Assistant ("Structurer avec l'IA") | Mentor | FR | Prod | AI structures / degrades | "Fill manually" — graceful (providers down) | PASS(degrade) | QA-AI-007 | screenshot |
| T-SESS-03 | Sessions | Local draft autosave (offline) | Mentor | FR | Prod | Saved locally | "Enregistré sur cet appareil" | PASS | — | screenshot |
| T-SESS-04 | Sessions | Session-log required-field validation | Mentor | FR | Prod | Require key fields | Saved with empty type/summary | OBSERVE | minor | screenshot |
| T-MEET-01 | Meetings | Schedule a meeting | Mentor | FR | Prod | Created + in Upcoming | "[QA TEST]" meeting created | PASS | — | page text |
| T-MEET-02 | Meetings | Cancel a meeting | Mentor | FR | Prod | Cancelled + removed | Moved to Past as ANNULÉE | PASS | — | screenshot |
| T-MENT-NOTES | Journal | Mentor private notes stay mentor-only | Mentor | — | code | Hidden from all others | Verified in code | REVIEW | — | reflections/visibility.ts |
| T-ADM-CRUD-01 | Admin | Programme create | Admin | EN | Prod | Created + feedback | "QA Test Programme" DRAFT, "Programme created." | PASS | — | screenshot |
| T-ADM-CRUD-02 | Admin | Cohort create | Admin | EN | Prod | Created | "QA Test Cohort" created | PASS | — | screenshot |
| T-ADM-CRUD-03 | Admin | Cohort date-range validation | Admin | EN | Prod | Reject end<start | Accepted inverted range | FAIL | QA-COHORT-008 | screenshot |
| T-ADM-FORMS-01 | Admin | Forms builder renders (all types, bilingual) | Admin | EN | Prod | Full builder | Renders (types/reorder/roles/EN+FR Q) | PASS | — | page text |
| T-ADM-SUP-01 | Admin | Support queue shows request + controls | Admin | EN | Prod | Request+identity+status | Renders (Segun's request, response/status) | PASS | — | page text |
| T-ADM-I18N | i18n | Admin dashboard translates to FR | Admin | FR | Prod | French | Hardcoded English | FAIL | QA-I18N-006 | screenshot |
| T-ADM-IMPORT | Imports | CSV/XLSX import + validation workflow | Admin | EN | Prod | Validate→commit | Needs file upload — driven browser can't | BLOCKED | — | — |
| T-ADM-INVITE | Invites | Create/revoke invite | Admin | EN | Prod | Lifecycle | Deferred (email caution) | BLOCKED | — | — |
| T-LIFE-07..N | Lifecycle | Profile edit/avatar, Goal Coach, Sessions+AI, Meetings, Journal, Agreements, Reviews, Notifications | Mentor+Mentee | EN/FR | Prod | End-to-end | partially run (mentor side) | 🟡 | — | in progress |
| T-PUB-01..N | Public | Homepage/About/FAQ/language switch (unauth) | anon | EN/FR | Prod | Renders/links | not run | BLOCKED | — | needs logout |
| T-A11Y-01..N | A11y/Responsive | Keyboard, focus, contrast, breakpoints | all | — | Prod | WCAG AA | not run | — | — | — |
| T-NI-01 | Forum | Forum threads/categories | — | — | — | — | No route | N/I | — | inventory |
| T-NI-02 | Clinics | Clinic RSVP/questions | — | — | — | — | No route | N/I | — | inventory |
| T-NI-03 | Newsletters | Newsletter draft/send | — | — | — | — | No route | N/I | — | inventory |
| T-NI-04 | Roles | Trainer / Reviewer as distinct roles | — | — | — | — | Folded into Super Admin | N/I | — | roles.ts |

\* `BLOCKED*` = reachable as admin but not yet exercised this pass; not role-blocked.

> This matrix will expand as the Mentor/Mentee lifecycle phases are executed. Every discovered feature is represented; rows marked `BLOCKED`/blank are the outstanding work.
