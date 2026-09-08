# BLAK MOH Certificate Redesign Report

Date: 2026-07-25
Status: Implemented and browser/PDF verified, with one evidence limitation noted below

## Outcome

The certificate experience now includes both sides of issuance:

- `/certificate` remains the participant-owned route and now shows an eligibility checklist, programme/cohort context, stable certificate ID, independent English/French output selection, marked preview state, print preview, and official PDF download only when earned.
- `/admin/certificates` is a new Super Admin-only management screen with real participant selection, programme/cohort/role context, certificate language selection, eligibility status, preview generation, regeneration from current records, and PDF/marked-preview download.
- `/api/certificates/[matchId]/pdf` generates a private, no-store A4 landscape PDF on the server. Owner or cohort-scoped Super Admin access is required for every request.

No participant, administrator, authentication, storage, realtime, localization, or existing certificate route was removed.

## Confirmed defects fixed

### CERT-001 — Certificate eligibility bypassed review completion

- Severity: P1
- Before: certificate issuance checked only training plus an approved goal, while the journey and UI required both reviews.
- Fix: eligibility now mirrors the existing completion journey exactly: training complete, approved/completed goal, submitted mid-term review, and submitted final review.
- Verification: the seeded matched participant has an approved goal but incomplete training/reviews and remains marked `PREVIEW`; an unmarked PDF request returns HTTP 409.

### CERT-002 — Certificate identifiers were collision-prone

- Severity: P2
- Before: ID used the last four cohort characters and last six match characters.
- Fix: a versioned SHA-256 derivation from the real accepted match and recipient role produces an 80-bit public identifier, separated into readable groups. It is stable, role-specific, reveals no participant data, and needs no fake/random issuance record.
- Verification: three unit tests cover stability, mentor/mentee separation, format, and source-ID concealment.

### CERT-003 — No stable downloadable certificate PDF

- Severity: P1
- Before: only `window.print()` was available; output depended on browser print behavior.
- Fix: `pdf-lib` now creates a single-page vector-text A4 landscape PDF with embedded official BLAK MOH assets and private response headers. Browser print remains available as a convenience.
- Verification: Poppler reports one A4 landscape page, PDF 1.7, no JavaScript, no forms, and correct English/French metadata. Both pages were rendered to PNG and inspected at 144 DPI.

### CERT-004 — No administrator certificate workflow

- Severity: P1
- Before: only a participant self-preview route existed.
- Fix: added a Super Admin route and navigation item with real participant selection, language, context, status, generate/regenerate, and download behavior.
- Verification: seeded Super Admin generated English and French previews on desktop and 390px mobile; unrelated participants receive a not-found response for direct URL access.

## Visual system

- Official repository lockup and mark only; no fake monogram, fake signature, random seal, or invented QR verification.
- Deep forest `#123F22`, brand green `#1F7338`, warm ivory `#FCFAF3`, and restrained gold `#A8782E`.
- Editorial serif hierarchy with sans-serif metadata and labels.
- Double ornamental border and restrained corner growth lines inside the print safe area.
- Blank signature lines for Programme Director and Authorized Coordinator; no signature names are invented.
- Ineligible browser and PDF output is visibly watermarked in the selected language.

## Bilingual wording and formatting

- English: `Certificate of Completion`.
- French: `Certificat d’achèvement` with reviewed accents and no mixed UI sentence fragments.
- Dates use `en-GB` or `fr-FR` month names in UTC.
- Certificate language is independent of interface language, so an administrator can issue the participant’s required language without changing their own portal locale.

## Name and print matrix

| Case | Sample | Result |
|---|---|---|
| Short | `Segun Diallo` | Pass in live browser preview |
| Very long | `Alexandra Chukwuemeka-Davies O'Connell` | Pass in English PDF; font scales without clipping |
| Hyphenated | Same English sample | Pass |
| Apostrophe | Same English sample | Pass |
| Accented French | `Élodie-Anne N'Diaye Kouamé` | Pass in French PDF; accents render correctly |
| Uppercase | Renderer uses measured width and scales down to 20pt | Automated sizing path covered; no database record was mutated solely for evidence |

## Authorization and state tests

| Test | Result | Evidence |
|---|---|---|
| Super Admin opens management screen | Pass | `certificate-evidence/admin-certificate-desktop.png` |
| Real participant/cohort selection | Pass | Desktop evidence |
| English preview | Pass | Desktop evidence |
| French preview | Pass | Mobile and participant evidence |
| Ineligible participant | Pass; preview only | Browser assertion and HTTP 409 official request |
| Duplicate/regenerate | Pass; same deterministic ID, latest records re-read | Browser assertion and unit tests |
| Download marked preview as admin | Pass; HTTP 200 PDF | Playwright response/body assertion |
| Download official certificate before completion | Pass; denied with HTTP 409 | Playwright assertion |
| Participant self preview | Pass | `certificate-evidence/participant-certificate-fr.png` |
| Unrelated participant direct URL | Pass; HTTP 404 | Playwright assertion |
| Unauthenticated API access | Protected by `getCurrentUser`; covered by route implementation and wider auth audit | Full audit matrix |
| Mobile 390px containment | Pass; page has no document-level horizontal overflow | `certificate-evidence/admin-certificate-mobile-fr.png` |
| Browser refresh/direct query | Pass; server-rendered query state reconstructs preview | Playwright direct navigation |
| Missing signature names | Pass by design; lines remain blank | PDF evidence |
| Missing programme/cohort | Blocked by required database relations; no destructive fixture was created | N/A |
| Eligible live participant | Blocked: configured safe dataset contains no participant satisfying all four requirements | Safe English/French synthetic PDFs validate official rendering without altering data |

## Evidence

- `certificate-evidence/admin-certificate-desktop.png`
- `certificate-evidence/admin-certificate-mobile-fr.png`
- `certificate-evidence/participant-certificate-fr.png`
- `certificate-evidence/sample-certificate-en.pdf`
- `certificate-evidence/sample-certificate-en.png`
- `certificate-evidence/sample-certificate-fr.pdf`
- `certificate-evidence/sample-certificate-fr.png`

Before-state evidence is source-backed by the Git baseline: participant-only `window.print()`, six-character match ID suffix, no admin route, and reviews omitted from eligibility. A browser screenshot was not captured before editing because the packaged audit-browser server failed to start on Windows before the baseline page could be opened. No fabricated “before” screenshot was substituted.

## Verification commands

- `npm run typecheck` — pass.
- Targeted Vitest certificate/i18n/journey tests — 22 passed.
- `npx playwright test tests/e2e/certificate-audit.spec.ts --project=chromium` — 4 passed.
- `npx tsx scripts/generate-certificate-evidence.ts` — two PDFs generated.
- Poppler `pdfinfo` and `pdftoppm` — A4 landscape metadata and visual render verified.

## Owner decisions / constraints

- The repository does not contain an approved official seal asset. The design uses the official BLAK MOH mark as a restrained centre emblem and does not label it a legal seal.
- No QR code or public verification route was invented.
- Formal certificate wording should receive programme/legal owner approval before live issuance, especially the official signatory titles. The implementation keeps signatory names blank until approved data exists.
