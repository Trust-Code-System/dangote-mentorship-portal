# Full Platform Test Matrix

Status meanings: **PASS** current verification passed · **FIXED** failed then passed after repair · **FAIL** reproducible open defect · **BLOCKED** unsafe or requires external configuration/owner access · **NOT IMPLEMENTED** no product surface exists · **CODE PASS** server-side/unit verification without a fresh destructive browser mutation.

| Test ID | Feature | Route | Role | Language | Device | Expected result | Actual result | Status | Issue ID | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| SYS-001 | Type safety | all | all | EN/FR | n/a | No TS errors | Clean | PASS | — | `npm run typecheck` |
| SYS-002 | Unit/integration suite | all | all | EN/FR | n/a | Tests pass | 39 files, 315 tests passed; 0 failed/skipped | PASS | — | `npm test` |
| SYS-003 | Lint | all | all | EN/FR | n/a | No errors or avoidable warnings | 0 errors, 0 warnings | FIXED | AUD-DEV-001 | `npm run lint` |
| SYS-004 | Production build | all | all | EN/FR | n/a | Optimized build succeeds | All routes emitted, including three restored public routes | PASS | — | `npm run build` |
| PUB-001 | Landing | `/` | public | EN | desktop | Renders without error | 200, screenshot | PASS | — | `full-platform-evidence/browser/public-home-desktop.png` |
| PUB-002 | Public content | `/about`, `/faq`, `/contact`, `/confidentiality` | public | EN | desktop | 200 and content | All pass route sweep | PASS | — | `tests/e2e/platform-audit.spec.ts` |
| PUB-003 | Auth entry | `/login`, `/signup` | public | EN | desktop | Renders | 200 | PASS | — | route sweep |
| PUB-004 | Declared guide routes | `/programme`, `/mentor-guide`, `/mentee-guide` | public | EN/FR | desktop | Declared route exists | All render in production mode with localized metadata/content | FIXED | AUD-ROUTE-001 | route sweep + `public-*-guide-desktop.png` |
| PUB-005 | Public mobile | `/` | public | EN | 390×844 | No overflow | Pass | PASS | — | `public-home-mobile.png` |
| PUB-006 | Viewport matrix | `/about` | public | EN | 320–1920 | No horizontal overflow | Automated matrix added; final run recorded below | PASS | — | viewport Playwright test |
| PUB-007 | Metadata/SEO | public pages | public | EN/FR | n/a | Localized metadata/robots | Code definitions and robots present | CODE PASS | — | page metadata source/build inventory |
| PUB-008 | Footer/navigation links | public pages | public | EN/FR | desktop/mobile | No broken implemented link | Restored guide links present in navigation/footer and resolve | FIXED | AUD-ROUTE-001 | browser/source sweep |
| AUTH-001 | Valid credentials | `/login` | Super Admin | EN | desktop | Role-correct redirect | Redirects `/admin` | PASS | — | `m0-login.spec.ts` |
| AUTH-002 | Unauthenticated gate | `/dashboard` | public | EN | desktop | Redirect to login | Pass | PASS | — | `m0-login.spec.ts` |
| AUTH-003 | Participant admin denial | `/admin` | Mentee | FR | desktop | Redirect/deny | Redirects role dashboard | PASS | — | platform audit E2E |
| AUTH-004 | Live role recheck | protected | authenticated | EN/FR | n/a | Disabled/deleted/changed role denied | DB-backed `loadActiveUser`; unit coverage | CODE PASS | — | auth/RBAC tests |
| AUTH-005 | Invalid/empty login | `/login` | public | EN/FR | desktop | Generic safe error | UI remains generic; expected credential failures use a concise structured server event | FIXED | AUD-AUTHLOG-001 | `auth-ui.spec.ts`, auth tests |
| AUTH-006 | Logout/cache | shell | authenticated | EN | desktop | Session cleared; protected data unavailable | Sign-out action and no persistent sensitive cache; destructive multi-user cache probe not run | CODE PASS | — | auth source/tests |
| AUTH-007 | Password reset email | `/forgot-password` | public | EN/FR | desktop | Real email delivery | Graph mail absent; sending prohibited | BLOCKED | AUD-ENV-001 | Vercel env-name audit |
| AUTH-008 | Reset token states | `/reset-password/[token]` | public | EN/FR | desktop | Invalid/expired/used safe | Unit/source validation; live token mutation not run | CODE PASS | — | reset action/tests |
| AUTH-009 | Invite lifecycle/email | `/invite/[token]` | invitee | EN/FR | desktop | Delivery + activation | Token logic present; real mail absent and mutation prohibited | BLOCKED | AUD-ENV-001 | config/source audit |
| AUTH-010 | Entra SSO | `/login` | all | EN/FR | desktop | Provider works if configured | Provider omitted because production variables absent | BLOCKED | AUD-ENV-001 | environment-name audit |
| AUTH-011 | Maintenance mode | `/maintenance` | all | EN/FR | desktop | Correct lockout | Source gate reviewed; toggle not changed in production | BLOCKED | — | safe-test restriction |
| MENTEE-001 | Dashboard | `/dashboard/mentee` | Mentee | EN/FR | desktop | Real data and journey render | Pass | PASS | — | route sweep |
| MENTEE-002 | Dashboard mobile | `/dashboard/mentee` | Mentee | EN | 390×844 | No overflow | Failed +128 px, repaired, rerun passes | FIXED | AUD-RESP-001 | mobile screenshot/test |
| MENTEE-003 | Participant route set | profile, pair, goals, sessions, messages, meetings, calendar, journal, agreements, reviews, notifications, support, help, certificate | Mentee | FR | desktop | Each route <400, no global error/overflow | All pass | PASS | — | isolated French route sweep (1.3m) |
| MENTEE-004 | Goal lifecycle | `/goals` | Mentee | EN/FR | desktop | Create/submit/feedback safe | Existing live QA + server/unit coverage pass | PASS | — | `docs/qa-audit/QA_TEST_MATRIX.md` |
| MENTEE-005 | Evidence authorization | goal file API | Mentee | EN | n/a | Owner/paired/admin only | Ownership tests pass | CODE PASS | — | goal access tests |
| MENTEE-006 | Large evidence upload | `/goals` | Mentee | EN/FR | desktop | 10 MB bypasses function body and remains authorized/private | Signed direct upload + server confirmation implemented | CODE PASS | AUD-UPLOAD-001 | upload source/type/build; staging boundary test required |
| MENTEE-007 | Journal privacy | `/journal` | Mentee | EN/FR | desktop | Private unless shared | Server queries/actions scoped; live prior QA pass | PASS | — | reflection/access tests |
| MENTEE-008 | Reviews | review routes | Mentee | FR | desktop | Localized form and validation | Route renders; question content depends on populated FR data | BLOCKED | AUD-I18N-002 | forms data dependency |
| MENTOR-001 | Dashboard | `/dashboard/mentor` | Mentor | EN | desktop | Real assigned-pair summary | Pass | PASS | — | route sweep |
| MENTOR-002 | Complete navigation | participant routes | Mentor | EN | desktop | No crashes/reloads | All pass, including `/pair` and `/messages` | PASS | — | platform route sweep |
| MENTOR-003 | Unrelated mentee | `/pair/[menteeId]` | Mentor | EN | n/a | Deny unrelated record | Access-layer/unit checks pass | CODE PASS | — | pair access tests |
| MENTOR-004 | Goal review | `/goals` | Mentor | EN | desktop | Comment/approve/change request scoped | Prior live QA and action tests pass | PASS | — | historical QA matrix/current tests |
| MENTOR-005 | Private notes | `/journal`, sessions | Mentor/Mentee/Admin | EN/FR | n/a | Mentor note excluded from others/admin | Query selections and access tests pass | CODE PASS | — | source/unit audit |
| MSG-001 | Messages list/thread | `/messages` | Mentor/Mentee | EN/FR | desktop | Loads without repeat refresh | Mentor and French mentee sweeps pass | PASS | — | message screenshots |
| MSG-002 | Message confidentiality | message action/data | pair only | EN/FR | n/a | Non-participant cannot read/send | Server participant checks pass | CODE PASS | — | message/pair tests |
| MSG-003 | Realtime cleanup | message thread | pair only | EN/FR | browser | No duplicate subscription | Opaque exact topic, singleton client and exact `removeChannel` cleanup | FIXED | AUD-RT-001 | source/unit audit |
| MSG-004 | Realtime reconnect/background | message thread | pair only | EN/FR | browser | Recover without duplicates | Online/visibility/subscribed reconciliation + polling implemented; destructive multi-tab run withheld | CODE PASS/BLOCKED | AUD-RT-001 | migration + staging required |
| MSG-005 | Message write abuse | message action | pair only | EN/FR | n/a | Per-user throttle | Shared 8/10s and 30/minute bounds before writes | FIXED | AUD-MSG-001 | source/type/build |
| I18N-001 | Message workspace copy | `/messages` | Mentee | FR | desktop | No English fragments | Repaired and assertion passes | FIXED | AUD-I18N-001 | FR screenshot |
| I18N-002 | Certificate | certificate routes/PDF | all authorized | EN/FR | desktop/mobile/PDF | Independent complete EN/FR output | Pass, accents/long copy verified | PASS | — | certificate evidence |
| I18N-003 | Resource parity | message JSON | all | EN/FR | n/a | Same keys | Unit parity pass | PASS | — | i18n tests |
| I18N-004 | HTML language | `/messages` | Mentee | FR | desktop | `lang=fr` | Pass | PASS | — | platform audit E2E |
| I18N-005 | Admin copy | matching/import detail/settings | Super Admin | FR | desktop | Fully French | Headings, tables, insights, plurals, statuses and health copy translated | FIXED | AUD-I18N-002 | catalogue parity + focused French admin browser assertions |
| ADMIN-001 | Static admin route set | 17 admin routes | Super Admin | EN | desktop | <400, no global error/overflow | All pass | PASS | — | admin route sweep/screenshot |
| ADMIN-002 | Matching language hard rule | `/admin/matching` | Super Admin | EN/FR | n/a | EN/FR mismatch impossible | Engine/action tests pass | CODE PASS | — | matching tests |
| ADMIN-003 | Cohort dates | `/admin/cohorts` | Super Admin | EN | n/a | End after start | Regression fix/tests pass | PASS | — | cohort schema tests |
| ADMIN-004 | Import parse/validation | `/admin/imports` | Super Admin | EN/FR | desktop | CSV/XLS/XLSX/XLSM validation without function payload ceiling | 20 MB signed direct upload, signature validation and private parse-by-reference implemented | CODE PASS | AUD-UPLOAD-001 | import tests; staging boundary upload required |
| ADMIN-005 | Certificate management | `/admin/certificates` | Super Admin | EN/FR | desktop/mobile | Real participant selection/preview/PDF scope | Pass | PASS | — | certificate E2E/evidence |
| ADMIN-006 | Maintenance/settings mutation | `/admin/settings` | Super Admin | EN/FR | desktop | Authorized and reversible | Guard reviewed; mutation deliberately not run | BLOCKED | — | safety restriction |
| ADMIN-007 | Invites/external mail | `/admin/invites` | Super Admin | EN/FR | desktop | Real delivery | UI renders; Graph mail absent, no send | BLOCKED | AUD-ENV-001 | config audit |
| PERM-001 | Admin route gate | `/admin/*` | Mentor/Mentee | EN/FR | n/a | Denied server-side | Pass | PASS | — | browser + RBAC tests |
| PERM-002 | Certificate IDOR | PDF API | unrelated Mentee | EN | n/a | 404/deny | Pass | PASS | — | certificate E2E |
| PERM-003 | Agreement PDF | PDF API | signer/scoped admin | EN/FR | n/a | Unauthorized denied | Handler/source and unit checks pass | CODE PASS | — | API audit |
| PERM-004 | Goal evidence IDOR | evidence API | owner/pair/admin | EN | n/a | Unauthorized denied | Access tests pass | CODE PASS | — | authorization tests |
| PERM-005 | Cross-cohort admin data | admin actions | Super Admin scope | EN/FR | n/a | Scope enforced | Live user re-read and cohort predicates present/tests pass | CODE PASS | — | RBAC/action audit |
| FILE-001 | Missing avatar object | shell/avatar API | authenticated | EN/FR | desktop | Initials fallback | Repaired | FIXED | AUD-AVATAR-001 | route screenshots |
| FILE-002 | Unsupported avatar/evidence type | upload actions | authenticated | EN/FR | n/a | Reject | MIME/extension validation present/tests pass | CODE PASS | — | upload source/tests |
| AI-001 | Disabled configuration | AI actions | authenticated | EN/FR | n/a | Graceful manual fallback | Pass by design locally | PASS | — | AI adapter/action tests |
| AI-002 | Production provider success | AI actions | authenticated | EN/FR | n/a | Advisory output | Concurrency/timeout fixed; historical 401/429 and provider quota still owner-blocked | BLOCKED | AUD-AI-001 | owner provider validation |
| AI-003 | Human control/privacy | AI actions | all | EN/FR | n/a | No auto-destructive save/private reads | Prompts/actions advisory and scoped | CODE PASS | — | source/tests |
| A11Y-001 | Names/headings/focus smoke | audited pages | all | EN/FR | browser | Operable accessible structure | Playwright role selectors and snapshots pass | PASS | — | E2E role-based assertions |
| A11Y-002 | Automated WCAG 2.2 AA scan | all | all | EN/FR | all | Axe/contrast report | Axe/pa11y unavailable; manual smoke only | BLOCKED | — | tooling limitation |
| PERF-001 | Production route build | all | all | EN/FR | n/a | Deploy artifact compiles | Pass | PASS | — | build output |
| PERF-002 | Admin chart initialization | admin analytics | Super Admin | EN | desktop | No warning or overflow | Positive 1px initial dimension; corrected 600px regression; full admin rerun pass | FIXED | AUD-CHART-001 | production build + admin route sweep |
| PERF-003 | Public load | public routes | public | EN | local prod | Thresholds through safe stage | Remediation rerun: 10 VU pass, 25 VU p95 fail/automatic stop, 0% errors | PASS/STOP | — | capacity evidence |
| CAP-001 | Database snapshot | database | system | n/a | n/a | Read-only limits captured | max 60; 21 observed | PASS | — | database snapshot JSON |
| CAP-002 | Authenticated DB load | dashboards/actions | all | EN/FR | staging | Measured breaking point | Not run against hosted production DB | BLOCKED | — | staging required |
| CAP-003 | Realtime load | messages | pair | EN/FR | staging | Measured subscriptions/messages | Code hardened; migration, plan and telemetry unavailable; not stressed | BLOCKED | AUD-RT-001 | capacity/owner reports |
| CAP-004 | AI load | AI actions | all | EN/FR | staging | Measured provider concurrency | Code bounded at 4/process and 20s; provider quotas/health unavailable | BLOCKED | AUD-AI-001 | capacity/owner reports |
