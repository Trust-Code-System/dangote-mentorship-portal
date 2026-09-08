# BLAK MOH — Authentication Experience Implementation Report

**Concept:** The Threshold — where a participant crosses from the public story into their private
mentorship journey. **Date:** 25 July 2026.

**Scope:** the visual and UX layer of the `(auth)` routes. **No authentication logic was changed** —
no provider, action signature, session handling, rate limiting, token validation, redirect or CSRF
behaviour. Verified by signing in for real (§6).

---

## 1. Current-state problems

The login page was a ~440px card centred in a large light page, sharing nothing with the new landing
experience. Behind that, discovery found seven real defects — five fixed here, two escalated:

| # | Problem | Status |
| - | ------- | ------ |
| 1 | **"Remember me for 30 days" did nothing.** The `remember` field was submitted but read by no server code anywhere in `src/`, and the session is capped at **12 hours** in `auth.config.ts`. A dead control that also misstated session length. | **Removed** — escalated below |
| 2 | **The invitation form's name field was labelled "BLAK MOH."** `invite-form.tsx` used `<Label htmlFor="name">{tc('appName')}</Label>` — the application name instead of "Full name". | **Fixed** |
| 3 | **The "Support" link was a dead end.** `/support` lives in `(dashboard)` and is not a public path, so a signed-out visitor was redirected back to `/login`. Verified: `GET /support` → `307 → /login`. | **Fixed** — now a `mailto:` |
| 4 | **"Privacy Policy" and "Terms of Service" both pointed at `/faq`.** Neither `/privacy` nor `/terms` exists. | **Partly fixed** — escalated below |
| 5 | `forgot-password`, `reset-password` and `invite` were unstyled shadcn `Card`s, visually unrelated to login. | **Fixed** |
| 6 | Reset and invite took a password with **no confirmation field and no stated requirements**. | **Fixed** |
| 7 | **Invalid and expired tokens were indistinguishable** — one generic message, so a user with a merely expired link was never told to request a new one. | **Fixed** |

---

## 2. Final design direction

Desktop is a split screen: a dark cinematic brand panel (~55%) beside the form on a **warm ivory
surface** (~45%). The ivory card against the dark page is the deliberate choice — it gives the form
the strongest read on the page, keeps input fields clear of glass blur, and reads as paper rather
than as a dialog floating on white.

Below `lg` the brand panel collapses to a compact header strip and the form becomes the whole page.

The brand panel carries a simplified version of the landing page's mentorship connection: mentor and
mentee forms standing on a horizon, a stream of light between them, and an illuminated goal above.
**CSS and inline SVG only** — the landing page's WebGL scene is not loaded here.

---

## 3. Routes redesigned

| Route | States covered |
| ----- | -------------- |
| `/login` | default · invalid credentials · rate limited · session expired (`?expired=1`) · provider error (`?error=…`) · loading · SSO (hidden — not configured) |
| `/forgot-password` | default · enumeration-safe success · rate limited |
| `/reset-password/[token]` | valid · **expired** · **invalid** (now distinct) |
| `/invite/[token]` | valid · **expired** · **already used** · **invalid** (now three distinct states) |
| `/signup` (request access) | invite-code redemption · ask an administrator |

Session-expiry and provider-error are query states on `/login`, not new routes: Auth.js already
redirects there via `pages.signIn`, so adding routes would have meant changing auth configuration.

---

## 4. Components created

All new, under `src/components/auth/`, used only by `(auth)`:

`AuthShell` · `AuthVisual` · `AuthCard` · `AuthHeader` · `AuthFooter` · `AuthLanguageSwitcher` ·
`AuthField` · `PasswordField` · `AuthSubmitButton` · `AuthAlert` · `AuthDivider` ·
`PasswordRequirements`

The portal's shared primitives (`Card`, `Input`, `Label`, `Button`, `LocaleSwitcher`, `BrandMark`)
were **not modified** — the auth experience got its own library rather than dark variants of
components the authenticated app depends on.

### Files modified

- `src/app/(auth)/layout.tsx` — replaced the centred light column with the shell
- `src/app/(auth)/login/{page,login-form}.tsx`
- `src/app/(auth)/forgot-password/{page,forgot-password-form}.tsx`
- `src/app/(auth)/reset-password/[token]/{page,reset-password-form}.tsx`
- `src/app/(auth)/invite/[token]/{page,invite-form}.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/globals.css` — added ivory surface tokens (additive)
- `tailwind.config.ts` — added `auth-*` colours (additive)
- `messages/{en,fr}.json` — `auth` namespace 40 → 93 keys; removed the now-unused `rememberMe`

### Packages added

**None.** No WebGL, no animation library, no new dependency — the auth pages are lighter than the
landing page by construction.

### React Bits components used

**None.** As on the landing page, no React Bits source is vendored (MIT + Commons Clause is not worth
inheriting for a handful of effects). The brand panel's light field reuses the original
`.landing-*` CSS effects already written for this project.

### Authentication logic changed

**None.** One presentation-layer behaviour was added inside the login *component*: the email field is
now controlled so it survives a failed submission (React 19 resets uncontrolled forms once an action
settles, so the address had to be retyped after any password typo). The password is deliberately left
uncontrolled so it clears on failure. The server action is untouched.

---

## 5. Verification

| Check | Result |
| ----- | ------ |
| `npm run typecheck` | clean |
| `npx eslint src/components/auth src/app/(auth)` | **0 problems** |
| `npm test` | **281 passed / 33 files** |
| `npx playwright test` (whole suite) | **19 passed** — 9 new auth-UI tests, plus landing and the original login spec |

The new `tests/e2e/auth-ui.spec.ts` covers the UX contract a screenshot cannot: one `h1`, real
associated labels, keyboard-operable password toggle, language switching that does **not** clear a
typed email, a failed sign-in that keeps the email and clears the password, enumeration-safe reset,
usable-error states for bad tokens, reachable footer links, and no overflow at 320px.

### Real authentication still works

Signed in with the seeded super-admin account against the running app: `POST /login → 303`, session
created, role redirect to `/admin`, dashboard renders in full —
`auth-ui-evidence/post-login-admin-dashboard.png`. The authenticated portal is visually unchanged.

### A pre-existing failure I need to flag

`tests/e2e/m0-login.spec.ts` fails in this environment with `ERR_CONNECTION_REFUSED`, and it is
**not** caused by this work:

> `.env` sets `AUTH_URL="http://localhost:3000"` while Playwright runs the app on **3001**. Auth.js
> builds its redirect from `AUTH_URL`, so `/dashboard` on 3001 redirects to
> `http://localhost:3000/login…` — a port with nothing on it. `playwright.config.ts` even documents
> the opposite ("Port 3001 matches AUTH_URL in .env"), so `.env` is out of sync with its own stated
> intent.

Proven both ways: with `AUTH_URL=http://localhost:3001` the spec **passes (2/2)**; without it, it
fails before reaching any of my UI. The same wrong-port redirect was visible earlier when probing
footer links, before any auth file was edited. **`.env` was not modified** — environment
configuration is the owner's call.

---

## 6. Test results

**Desktop (1440×900, 1024×768):** split screen renders correctly, form is 460px, all states verified.
**Tablet (768×1024):** stacked layout with the compact header; touch targets ≥44px.
**Mobile (390×844, 375×812, 320×568):** single column, no horizontal overflow at any width, fields
56px, body text ≥16px, safe-area padding on the bottom.

**English:** complete. **French:** complete, with correct French typography (`Mot de passe oublié ?`,
`Besoin d'un compte ?`) and no clipped labels — `auth-ui-evidence/login-french.png`.

Two defects were found by testing and fixed during the pass:

- the language switcher appeared **twice** on mobile (header strip *and* card) — removed from the header;
- at 320–390px "Français" was **clipped by the card edge** — the switcher now takes its own line below `sm`.

### Accessibility

- One `h1` per page; labels always visible and associated (verified in-browser, not assumed).
- Errors wired with `aria-invalid` + `aria-describedby`; `role="alert"` for errors, `role="status"`
  for success; the submit button carries `aria-busy` and swaps to "Signing in…".
- Password toggle is a real button with a state-dependent accessible name ("Show password" /
  "Hide password"), 44px, keyboard-operable — asserted in e2e.
- Language switcher is a labelled `role="group"` of `aria-pressed` buttons, 44px minimum.
- Focus ring is brand green at 7.4:1 on black / high contrast on ivory; no focus outline removed.
- Ink on ivory is 17.4:1; muted ink 7.6:1.
- Decorative visual is `aria-hidden`; paste is never blocked and password managers are unobstructed.
- Invitation email is `readOnly`, not `disabled`, so a keyboard user can still read the address they
  are about to activate.

### Performance

No new dependencies, no WebGL, no images beyond the existing brand mark, no animation library. The
form markup is server-rendered and interactive immediately; the visual is pure CSS/SVG behind it.
Auth pages are meaningfully lighter than the landing page.

---

## 7. Missing routes

| Link | Reality | Handling |
| ---- | ------- | -------- |
| Privacy Policy | no `/privacy` route | links to `/faq`, labelled **"Confidentiality"** rather than mislabelled as a policy |
| Terms of Service | no `/terms` route, no approved copy | **omitted** — no placeholder legal text was invented |
| Support | `/support` is auth-gated | replaced with `mailto:` so it works when you cannot sign in |

---

## 8. Remaining blockers and owner decisions

1. **Remember-me** — removed because it did nothing and promised 30 days against a 12-hour session.
   Re-add only with real backend support and a truthful label.
2. **Terms of Service** — needs an owner-approved page before it can be linked.
3. **Privacy Policy** — confirm whether to author a dedicated route or keep pointing at the FAQ.
4. **Support inbox** — currently `admin@blakmoh.com`, inherited from `/signup`. Confirm the real address.
5. **`AUTH_URL` port mismatch in `.env`** — breaks `m0-login.spec.ts` locally (§5). One-line fix, but
   it is environment configuration so I have not touched it.
6. **Entra SSO** — not configured (all three env vars empty), so the button stays hidden. The gate is
   preserved exactly: a half-configured tenant breaks *every* sign-in, including credentials.

---

## 9. Status summary

| | |
| --- | --- |
| **Implementation status** | Complete |
| **Routes redesigned** | 5 of 5 (login, forgot, reset, invite, request access) + shared layout |
| **Auth flows verified** | Real sign-in → admin dashboard · failed sign-in · reset request · invalid/expired reset · valid & invalid invitation · request access · language switching |
| **Desktop** | Split-screen brand panel + ivory form, verified 1440×900 and 1024×768 |
| **Mobile** | Stacked, verified 390×844, 375×812, 320×568 — no overflow |
| **English** | Complete |
| **French** | Complete, correct typography, no clipping |
| **Accessibility** | Labels, ARIA, focus, contrast and keyboard operation verified; 9 e2e assertions |
| **Performance** | No new packages, no WebGL; form interactive immediately |
| **Missing routes** | `/privacy`, `/terms` (Terms omitted); `/support` not public (mailto used) |
| **Remaining blockers** | None in code. Four owner decisions + the pre-existing `AUTH_URL` mismatch. |
| **Evidence** | `auth-ui-evidence/` — 16 screenshots incl. error, loading, success, expired, French, and post-login |
