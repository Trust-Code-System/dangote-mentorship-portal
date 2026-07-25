# PUBLIC PAGES — ROUTE MAP

Discovery output. Every route below was read from the repository, not assumed.

## 1. Where public routing is decided

| Concern | File |
| --- | --- |
| Which paths are reachable signed-out | `src/lib/auth/auth.config.ts` → `PUBLIC_PREFIXES` / `isPublicPath()` |
| Landing chrome (dark) | `src/app/(landing)/layout.tsx` |
| Public informational chrome (light, legacy) | `src/app/(public)/layout.tsx` → `SiteHeader` + `SiteFooter` |
| Auth chrome | `src/app/(auth)/layout.tsx` → `AuthShell` |

`isPublicPath()` allow-list **before** this work:

```
'/', '/login', '/signup', '/invite/*', '/maintenance',
'/forgot-password', '/reset-password/*', '/api/auth/*',
'/about', '/faq', '/programme', '/mentor-guide', '/mentee-guide',
'/design'  (non-production only)
```

`/programme`, `/mentor-guide`, `/mentee-guide` are allow-listed but **no page exists** for
them — they are dead entries, not linked from anywhere. Left untouched (harmless; removing
them is a separate call for the owner).

## 2. Footer links found

### `src/app/(landing)/components/landing-footer.tsx` (the cinematic landing footer)

| Label (en) | Destination before | Real? |
| --- | --- | --- |
| About the programme | `/about` | ✅ exists |
| FAQ | `/faq` | ✅ exists |
| Confidentiality | `/faq` | ⚠️ **placeholder** — no confidentiality page existed |
| Support | `mailto:admin@blakmoh.com` | ⚠️ **placeholder** — seeded demo address, not an approved inbox |
| Sign in | `/login` | ✅ |
| Request access | `/signup` | ✅ |
| English / Français | `setLocale` server action (cookie) | ✅ |

### `src/components/site-footer.tsx` (legacy light footer on `/about`, `/faq`, `/design`)

About → `/about`, FAQ → `/faq`. No confidentiality, no support, no language control.
Visually unrelated to the landing footer.

### `src/components/auth/auth-card.tsx` → `AuthFooter` (below every auth card)

| Label | Destination before |
| --- | --- |
| Confidentiality | `/faq` (placeholder) |
| Support | `mailto:admin@blakmoh.com` (placeholder) |
| Back to home | `/` |

### `src/app/(landing)/components/landing-nav.tsx`

Programme `#programme` · Matching `#matching` · Journey `#journey` · Experience `#experience` ·
FAQ `/faq` · Sign in `/login` · Request access `/signup` · EN/FR toggle.

## 3. Routes that 404'd or were placeholders

| Path | Status before |
| --- | --- |
| `/confidentiality` | **did not exist** — footer pointed at `/faq` instead |
| public support page | **did not exist** — footer used a `mailto:` |
| `/privacy` | does not exist, never linked |
| `/terms` | does not exist, deliberately omitted from the auth footer (no approved copy) |
| `/programme`, `/mentor-guide`, `/mentee-guide` | allow-listed in auth config, **no page** |

## 4. The `/support` collision (important)

`/support` is **already taken** by the authenticated participant support-request workflow:

- `src/app/(dashboard)/support/page.tsx` — signed-in participants raise a private request
- `src/features/support/{actions,data,queue}.ts` — admin-visible queue

A second `src/app/(pages)/support/page.tsx` would be a duplicate-route build error, and
adding `/support` to `PUBLIC_PREFIXES` would have **made the private request page public**.

→ The public support page is therefore at **`/contact`**, labelled "Support" in the
navigation and footer. `/support` keeps its exact current meaning and gating.

## 5. Final route map

| Label (en) | Label (fr) | Route | Auth | Before | After | Component |
| --- | --- | --- | --- | --- | --- | --- |
| About the programme | Le programme | `/about` | public | thin 3-card page | **redesigned** | `src/app/(pages)/about/page.tsx` |
| FAQ | FAQ | `/faq` | public | 2 static cards | **redesigned + search** | `src/app/(pages)/faq/page.tsx` |
| Confidentiality | Confidentialité | `/confidentiality` | public | **404** | **new** | `src/app/(pages)/confidentiality/page.tsx` |
| Support | Assistance | `/contact` | public | **did not exist** | **new** | `src/app/(pages)/contact/page.tsx` |
| Sign in | Se connecter | `/login` | public | premium auth | unchanged | `src/app/(auth)/login` |
| Request access | Demander un accès | `/signup` | public | premium auth | unchanged | `src/app/(auth)/signup` |
| English / Français | — | cookie action | public | unchanged | unchanged | `src/i18n/actions.ts` |
| Home | Accueil | `/` | public | cinematic landing | chrome unified | `src/app/(landing)` |
| (private) Support request | | `/support` | **auth** | unchanged | unchanged | `src/app/(dashboard)/support` |
| (dev only) Design gallery | | `/design` | public in dev | unchanged | unchanged | `src/app/(public)/design` |

Locale is a **cookie**, not a path segment (`NEXT_LOCALE`, set by `src/i18n/actions.ts`), so
every route above has exactly one URL in both languages. Switching language never navigates —
it re-renders server components in place, so scroll position, search state and open
accordions all survive.

## 6. Access model (verified, not assumed)

Read from `src/app/(auth)/signup/page.tsx`, `src/features/invites/`, and
`src/app/(auth)/invite/[token]/`:

- **Invitation-only.** There is no self-service account creation anywhere in the codebase.
- An administrator creates the account and issues an invite; the invitee redeems a code at
  `/signup` (which routes into `/invite/[token]`) or clicks the emailed link directly.
- Codes can be **invalid**, **expired**, or **already used** — all three states already have
  real copy and handling (`auth.inviteInvalidTitle` / `inviteExpiredTitle` / `inviteUsedTitle`).
- So `/signup` must stay an invite-redemption + "ask your administrator" page. **No public
  application form is invented.**
