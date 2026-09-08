# Pair / Messages intermittent load failure — fix report

**Date:** 2026-07-25  
**Environment:** Production (`dangote-mentorship-portal.vercel.app`), Next.js 16.2 App Router  
**Features removed:** 0  
**Routes removed:** 0  

---

## Exact root cause

Two interacting defects caused intermittent **Next.js default global error** UI  
(“This page couldn’t load” / “Reload to try again, or go back”) during **client-side sidebar navigation** to `/pair` and `/messages`:

### 1. Server `redirect()` on the happy path + intentional prefetch / router cache

- `/messages` called `redirect(/messages/[id])` whenever any conversation existed.
- `/pair` called `redirect(/pair/[menteeId])` for a mentee with a single accepted pair.

With recent navigation work (`prefetch={false}` on Links but `router.prefetch` on hover/focus, plus `experimental.staleTimes.dynamic: 60`), a hover prefetch could cache a **redirect Flight payload**. The subsequent click then applied that redirect during soft navigation. Under race / stale Flight conditions this surfaces as Next’s **default `global-error`** (full-screen, shell gone)—exactly matching the production screenshot—not our branded `error.tsx` copy.

### 2. Thrown `UnauthenticatedError` from page `requireUser()`

Page Server Components used `requireUser()`, which **throws** when the session/DB user is briefly unavailable. Thrown errors in RSC soft-nav become error-boundary failures. Reloading issues a full document request that usually succeeds, which matches “reload once or twice fixes it.”

Secondary contributors (hardened, not primary):

- `ensureDirectConversations` create race under parallel prefetch + navigate (now idempotent).
- Pair workspace `Promise.all` of optional widgets (one failure killed the page; now `Promise.allSettled`).
- Root `error.tsx` depended on `next-intl`; a provider glitch could cascade into the **builtin** global error screen.
- No segment-level `error.tsx` under `(dashboard)` / `pair` / `messages`, so failures replaced the whole tree including AppShell.

---

## Why reloading temporarily resolved it

A hard reload:

1. Bypasses the client Router Cache / prefetched redirect Flight.
2. Runs a fresh full RSC document request (no soft-nav redirect race).
3. Usually hits a warm DB connection and a stable session cookie path.

So the same routes and data worked after reload even though the underlying race remained.

---

## Fix implemented

| Change | Purpose |
|--------|---------|
| `/messages` renders `MessagesWorkspace` in-place (no server redirect) | Eliminate redirect Flight races |
| `/pair` mentee single-pair renders `PairWorkspaceView` in-place | Same |
| `requirePageUser()` → `redirect('/login')` on pages | Auth gaps no longer throw into error UI |
| `(dashboard)/error.tsx`, `pair/error.tsx`, `messages/error.tsx` + `SegmentError` | Shell stays; Retry = `router.refresh()` + `reset()` |
| Root `error.tsx` / `global-error.tsx` static copy + Retry | No i18n/CSS cascade into builtin global error |
| `ensureDirectConversations` race-safe create | Concurrent provision no longer crashes |
| Pair optional queries via `Promise.allSettled` | Secondary widget failure keeps workspace up |
| MessageThread realtime subscribe wrapped in try/catch | Realtime failure never crashes the thread |

Navigation caching (`staleTimes`, intent prefetch) **retained** — the failure was redirect-on-prefetch, not caching itself.

---

## Files changed

- `src/app/(dashboard)/messages/page.tsx`
- `src/app/(dashboard)/messages/[conversationId]/page.tsx`
- `src/app/(dashboard)/messages/error.tsx` *(new)*
- `src/app/(dashboard)/pair/page.tsx`
- `src/app/(dashboard)/pair/[menteeId]/page.tsx`
- `src/app/(dashboard)/pair/error.tsx` *(new)*
- `src/app/(dashboard)/error.tsx` *(new)*
- `src/app/error.tsx`
- `src/app/global-error.tsx`
- `src/features/messages/messages-workspace.tsx` *(new)*
- `src/features/messages/data.ts`
- `src/features/messages/message-thread.tsx`
- `src/features/pair/workspace-view.tsx` *(new)*
- `src/features/pair/data.ts`
- `src/lib/auth/page-user.ts` *(new)*
- `src/components/shell/segment-error.tsx` *(new)*
- `messages/en.json`, `messages/fr.json` (`common.retry`)
- `tests/messages/ensure-conversations.test.ts` *(new)*

---

## Queries involved

- **Messages:** `getMentorPairings` / `getMenteePairing` → `ensureDirectConversations` → `listConversations` → `getThread` → `markConversationRead` (participant-scoped; unchanged authz).
- **Pair:** `getViewablePairs` → `getPairWorkspace` (accepted `Match` + role check via `pairAccessFromMatch`; optional profile/goal/meeting/action queries settled independently).

---

## Cache / subscription changes

- **No change** to `staleTimes` or sidebar prefetch strategy.
- Realtime: still one Broadcast channel per `conversationId`; subscribe failures are swallowed; cleanup still `removeChannel` on unmount.
- No TanStack/SWR; no localStorage for private message/pair payloads.

---

## Error-handling changes

- Expected empty states (unmatched, no conversation, unauthorized thread/pair) → **inline empty UI**.
- Transient page failures → **segment error** with Retry (no full reload).
- Global fallback → branded/static Retry + Back (never rely on next-intl there).

---

## Tests performed

| Test | Result |
|------|--------|
| Unit: `ensureDirectConversations` race / rethrow | Pass (2) |
| Unit: pair access, i18n parity, nav-item-state | Pass |
| `tsc --noEmit` | Pass |
| Live production 20× nav matrix (matched mentor/mentee, unmatched, EN/FR, mobile/desktop, slow 3G) | **Pending post-deploy QA** — code path verified; confirm on Vercel after ship |

---

## Results (expected after deploy)

| Surface | Status |
|---------|--------|
| `/pair` | In-place workspace or empty/picker; no redirect race |
| `/messages` | In-place workspace or empty list; no redirect race |
| Matched user | Pair + DM workspace load without global error |
| Unmatched user | Empty states, no crash |
| Realtime messaging | Preserved; degrades silently if channel fails |
| Desktop / Mobile | Shell + segment errors |
| English / French | UI strings + `common.retry` |

---

## Features removed

**Zero.**

## Routes removed

**Zero.** (`/pair`, `/pair/[menteeId]`, `/messages`, `/messages/[conversationId]` all remain.)

---

## Remaining limitations

1. Mentors with multiple mentees still use `/pair/[menteeId]` deep links (no index redirect; by design).
2. Deep-link to an invalid `conversationId` shows the list + “select conversation” rather than a hard 404 (intentional safer UX).
3. Full 20× production navigation matrix should be re-run after deploy to confirm zero global-error occurrences under slow network.
4. True DB outages still show the segment Retry UI (correct); they are not silently ignored.
