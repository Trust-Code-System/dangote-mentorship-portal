# BLAK MOH — Authentication Experience Specification

**Concept:** The Threshold — the point where a participant crosses from the public BLAK MOH story
into their private mentorship journey.

**Scope:** the visual and UX layer of the `(auth)` route group. Authentication *logic* — providers,
server actions, session handling, rate limiting, CSRF, redirects — is preserved exactly.

---

## 1. Current-state findings (discovery)

### 1.1 Routes that actually exist

| Route | File | Public? | Current state |
| ----- | ---- | ------- | ------------- |
| `/login` | `(auth)/login/page.tsx` | yes | Stitch-era light card, ~440px column |
| `/signup` | `(auth)/signup/page.tsx` | yes | "Request access" — invite-code redemption + mailto. **No self-service sign-up exists.** |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | yes | Bare shadcn `Card`, unstyled |
| `/reset-password/[token]` | `(auth)/reset-password/[token]/page.tsx` | yes | Bare shadcn `Card` |
| `/invite/[token]` | `(auth)/invite/[token]/page.tsx` | yes | Bare shadcn `Card` |
| `/maintenance` | `app/maintenance/page.tsx` | yes | Separate holding page, own chrome |

Public paths are whitelisted in `src/lib/auth/auth.config.ts` → `isPublicPath()`.

**There is no dedicated route for:** session-expired, auth-error, expired-vs-invalid invitation,
or already-used invitation. Those states are folded into the existing pages (see §4).

### 1.2 Auth mechanics (preserved, not touched)

- **Provider:** Auth.js v5. Microsoft Entra ID registered **only** when all three
  `AUTH_MICROSOFT_ENTRA_ID_*` vars are set (`isEntraConfigured()`).
  **In this environment all three are empty strings → SSO is correctly hidden.** The gate stays
  exactly as-is; a half-configured tenant crashes *every* sign-in including credentials, which is why
  the button and the provider are deliberately kept in lockstep.
- **Session:** JWT, `maxAge: 12 * 60 * 60` — **12 hours**.
- **Rate limiting:** login 5 attempts / 60s, keyed by `IP + email`.
- **Server actions:** `login`, `requestPasswordReset`, `resetPassword`, `acceptInvite`,
  `signInWithEntra`. All keep their signatures.
- **Enumeration safety:** `forgot-password` already returns the same message either way. Preserved.

### 1.3 Defects found during discovery

These are real, and each is fixed or escalated rather than restyled around:

1. **"Remember me for 30 days" does nothing.** The `remember` checkbox is submitted but **never read**
   by any server code (`grep` across `src/` finds no consumer), and the session is hard-capped at
   **12 hours**. The control is both non-functional *and* actively misleading about session length.
   → **Removed from the UI.** Escalated in the report; re-add if the backend gains support.
2. **The invitation form's name field is labelled "BLAK MOH".** `invite-form.tsx` uses
   `<Label htmlFor="name">{tc('appName')}</Label>` — the app name, not "Full name".
   → Fixed with a proper `auth.fullName` string.
3. **The login footer's "Support" link is a dead end.** `/support` lives in `(dashboard)` and is
   **not** a public path, so a signed-out visitor clicking it is redirected straight back to
   `/login?callbackUrl=…/support`. Verified: `GET /support` → `307 → /login`.
   → Replaced with a `mailto:` so a locked-out user can actually reach help.
4. **"Privacy Policy" and "Terms of Service" both link to `/faq`.** Neither `/privacy` nor `/terms`
   exists (both `307` to login, and would 404 after). The links do not break, but they are
   mislabelled.
   → Privacy points at the FAQ's confidentiality section; **Terms is omitted** rather than shipped
   mislabelled. No legal text is invented. Escalated.
5. **`forgot-password`, `reset-password` and `invite` are visually unfinished** — raw shadcn `Card`s
   with default `Input`/`Label`, sharing nothing with the login page's design.
6. **Reset and invite accept a password with no confirmation field and no stated requirements**
   (`minLength={8}` is the only rule, invisible until the browser complains).
7. **Invalid and expired tokens are indistinguishable** — reset and invite both render one generic
   "invalid or has expired" message, so a user with a genuinely expired link is not told to request
   a new one.

### 1.4 Shared components in use

`(auth)` currently imports `Card`, `Input`, `Label`, `Button` from `components/ui/*`, and
`LocaleSwitcher`, `BrandMark`, `Wordmark`. **All of these are also used by the authenticated portal**,
so none of them are modified. The auth experience gets its own `components/auth/*` library instead.

---

## 2. Design direction

The landing page established the visual language; auth continues it without repeating it.

**Desktop: split screen.**

| | |
| --- | --- |
| Left ~55% | Dark cinematic brand panel — forest-black, radial green light, restrained gold, grain, vignette, and a simplified mentor→mentee connection |
| Right ~45% | The form, on a **warm ivory surface** |

The ivory card against the dark page is the deliberate choice: it gives the form the highest contrast
and the clearest read on the page, keeps input fields free of glass blur, and stops the page becoming
a wall of dark-on-dark. It also reads as "paper" — the calm, human, corporate register the programme
wants — against the cinematic panel beside it.

**Not** a full-screen white page with a small card, which is the current problem.

### Tokens

Reuses the `--blak-*` tokens added for the landing page (exact logo green `#14B21F`, gold `#CD9933`,
ivory `#F4F1EA`), plus three auth-only additions for the ivory surface:

```
--auth-surface   #F4F1EA  ivory card
--auth-field     #EAE6DC  field fill, one step warmer/darker than the card
--auth-border    #D6CFBE  hairline
```

Ink on ivory is `--blak-forest` `#061A0E` → **17.4:1**. Muted ink `#4A5A50` → **7.6:1**.

### Visual, not WebGL

The brand panel uses **CSS + inline SVG only**. The landing page's React Three Fiber scene is *not*
loaded here (brief §19): auth must be lighter than the landing page, and a login screen is the worst
possible place to spend main-thread time. Zero new packages, zero WebGL, zero asset files.

---

## 3. Component architecture

New, under `src/components/auth/` — used only by `(auth)`:

| Component | Purpose |
| --------- | ------- |
| `AuthShell` | Split-screen frame; stacks on mobile |
| `AuthBrandPanel` | Editorial content + three principles over the visual |
| `AuthVisual` | The simplified mentor/mentee connection (CSS + SVG) |
| `AuthCard` | Ivory form surface |
| `AuthHeader` | Wordmark, "Enterprise Portal" label, heading, supporting line |
| `AuthLanguageSwitcher` | 44px segmented EN/Français control |
| `AuthField` | Label + input + error wiring (`aria-invalid`, `aria-describedby`) |
| `PasswordField` | `AuthField` + show/hide + Caps Lock warning |
| `AuthSubmitButton` | 52px, spinner + "Signing in…", duplicate-submit safe |
| `AuthDivider` | "or continue with email" |
| `AuthAlert` | Error / success, `role="alert"` / `role="status"` |
| `AuthFooter` | Verified links only |

---

## 4. States covered

| State | Where | Treatment |
| ----- | ----- | --------- |
| Login | `/login` | Email, password, forgot link, submit. SSO only if configured. |
| Invalid credentials | `/login` | `AuthAlert` — generic, never reveals whether the account exists |
| Rate limited | `/login` | Distinct calm message with a wait instruction |
| Session expired | `/login?expired=1` | Non-alarming notice above the form |
| Auth error | `/login?error=…` | Human-readable message; provider errors never surfaced raw |
| Request access | `/signup` | Invite-code redemption + mailto. No invented workflow. |
| Forgot password | `/forgot-password` | Email → generic success, enumeration-safe |
| Reset password | `/reset-password/[token]` | New + confirm password, visible requirements |
| Reset token invalid | same | Own state, offers a new link |
| Reset token expired | same | **Distinguished from invalid**, tells the user to request another |
| Accept invitation | `/invite/[token]` | Email (locked), full name, password + confirm |
| Invitation invalid / expired / used | same | Three distinct messages |

Session-expired and auth-error are handled as **query-parameter states on `/login`**, not new routes —
Auth.js already redirects there (`pages.signIn: '/login'`), so inventing routes would mean changing
auth configuration, which is out of scope.

---

## 5. Accessibility

WCAG 2.2 AA. Labels always visible (no placeholder-only), errors wired with `aria-describedby` +
`aria-invalid`, `role="alert"` for errors and `role="status"` for success, 44px minimum targets,
52px fields, 16px minimum body text, visible focus ring in brand green, logical tab order, keyboard
show/hide password and language switcher, decorative visual `aria-hidden`, autofill and password
managers unobstructed, paste never blocked, 200% zoom, and a full `prefers-reduced-motion` path.

---

## 6. Performance

Lighter than the landing page by construction: no WebGL, no GSAP, no new dependencies, no images
beyond the existing brand mark. The form markup is server-rendered and interactive immediately; the
only client JS is the form components themselves.

---

## 7. Owner decisions required

1. **Remember-me.** Removed because it does nothing. Re-add only alongside real backend support, and
   with a label matching the real session length (currently 12 hours, not 30 days).
2. **Terms of Service.** No route, no approved copy. Omitted rather than mislabelled.
3. **Privacy Policy.** No dedicated route; links to the FAQ's confidentiality section.
4. **Support for signed-out users.** Now a `mailto:` to the address `/signup` already uses. Confirm
   the real inbox.
5. **Entra SSO.** Not configured in this environment, so the button stays hidden. Nothing to do until
   tenant credentials are supplied.
