# Live progress and backend AI controls

The partnership workspace previously displayed two completed steps, “Phase 3”,
and a 72% goal bar regardless of the saved records. It also labelled fixed copy
as an AI suggestion and displayed an editable-looking note with no action.

The workspace now derives each milestone from both partners' signatures,
submitted/approved goals, saved sessions and completed action items, and actual
certificate eligibility. The top-goal bar uses the same stage calculation as the
goal page. Recent session details come from a session log rather than the next
scheduled meeting. Shortcuts, agreement/PDF access and journal links lead to
existing working pages. Required query failures propagate to the error boundary
instead of fabricating zero counts.

The mentee dashboard and journey use the current accepted match's cohort.
Historical goals, signatures and sessions remain preserved but cannot complete
the current stream's milestones. Mentor goal reads are also scoped to each
accepted pair's cohort. Saved profiles, signatures, goals, sessions, reviews and
certificate decisions invalidate the dependent dashboard/workspace views.

Tests cover partial signatures, approval changes, stage percentages, open actions
and certificate gating. `tests/e2e/progress-live.spec.ts` uses disposable CI
Postgres only: historical fixtures must not inflate progress; actual browser
signing, mentor approval, goal advancement and action completion must persist
and change the displayed indicators. It does not mutate the real participants.

## AI controls

AI remains operationally disabled until activation is approved. Production
activation requires explicit `AI_MONTHLY_TOKEN_BUDGET` and
`AI_MONTHLY_REQUEST_LIMIT` settings. Each provider attempt atomically reserves
both allowances in shared Redis, with a UTC monthly window. A fallback attempt
uses another reservation; exhausted/unavailable accounting does not call another
provider. Failed attempts retain their conservative reservation.

`AI_MAX_INPUT_BYTES` bounds prompt size and `AI_MAX_OUTPUT_TOKENS` caps response
length. Existing per-user feature throttles and concurrency/timeouts remain.
No prompt, answer, account identity or API credential is stored in budget keys.
Budget units conservatively reserve input bytes, maximum output tokens and an
overhead margin; they are not billed token reports or a dollar guarantee. Set
the provider's own currency spending limit as well. Commercial pricing and the
owner's proposed monthly payment are not configuration values or spend caps.

Production upload verification currently blocks release: the configured Storage
project `owkgqglwvjlaizsfpuir` does not resolve. The owner opened the Supabase
dashboard, which shows a paused “Dangote Mentorship” project. Chrome window
inspection timed out twice, so project recovery requires the correct project
page/access. The database project remains reachable and was not paused or reset
by this work. No storage credentials were replaced or files moved.
