# BLAK MOH Authentication UI — TODO

Markers: `[ ]` not started · `[~]` in progress · `[x]` completed · `[!]` blocked

## Phase 1 — Discovery

- [x] Inspect every `(auth)` route and its server actions
- [x] Identify the auth provider and confirm SSO configuration state (Entra vars empty → hidden)
- [x] Read all validation and error handling
- [x] Confirm which components are shared with the authenticated portal
- [x] Verify legal/support link destinations (`/support` 307s back to login; `/privacy`, `/terms` absent)
- [x] Confirm remember-me is unimplemented and the session is 12h, not 30 days
- [x] Find the invite form's mislabelled name field
- [x] Write `AUTH_UI_SPEC.md` and this file

## Phase 2 — Tokens and copy

- [x] Add ivory auth surface tokens (`--auth-surface`, `--auth-field`, `--auth-border`)
- [x] Extend the `auth` namespace in `messages/en.json`
- [x] Extend the `auth` namespace in `messages/fr.json`

## Phase 3 — Component library

- [x] `AuthShell` (split desktop, stacked mobile)
- [x] `AuthBrandPanel` + `AuthVisual` (CSS/SVG, no WebGL)
- [x] `AuthCard`, `AuthHeader`
- [x] `AuthLanguageSwitcher` (44px segmented)
- [x] `AuthField`, `PasswordField` (show/hide + Caps Lock)
- [x] `AuthSubmitButton` (spinner, duplicate-submit safe)
- [x] `AuthDivider`, `AuthAlert`, `AuthFooter`

## Phase 4 — Routes

- [x] `/login` — incl. session-expired and auth-error query states
- [x] `/forgot-password`
- [x] `/reset-password/[token]` — confirm field, requirements, invalid vs expired
- [x] `/invite/[token]` — fix name label, confirm field, invalid/expired/used
- [x] `/signup` (request access)
- [x] Replace the `(auth)` layout with the new shell

## Phase 5 — Defect fixes

- [x] Remove non-functional remember-me
- [x] Fix invite name label ("BLAK MOH" → "Full name")
- [x] Replace dead `/support` link with a reachable contact
- [x] Stop labelling `/faq` as "Privacy Policy"; omit Terms

## Phase 6 — QA

- [x] `npm run typecheck` clean · eslint 0 problems in auth · 281 unit tests pass
- [x] Auth e2e — 9 tests in tests/e2e/auth-ui.spec.ts, all passing
- [x] Browser test every flow, EN + FR
- [x] Viewports 1440×900, 1024×768, 768×1024, 390×844, 375×812, 320×568
- [x] Reduced motion, keyboard-only, autofill, double-submit
- [x] Screenshots into `auth-ui-evidence/`
- [x] `AUTH_UI_IMPLEMENTATION_REPORT.md`

## Blocked / owner input

- [!] Terms of Service — no route and no approved copy; omitted
- [!] Privacy Policy — no dedicated route; links to the FAQ confidentiality section
- [!] Remember-me — removed pending real backend support
- [!] Support inbox address unconfirmed (`admin@blakmoh.com`, inherited from `/signup`)
