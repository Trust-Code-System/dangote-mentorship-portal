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

Production upload verification caught a paused Storage project,
`owkgqglwvjlaizsfpuir`. The owner restored it through Edge. Subsequent dashboard
inspection confirmed Healthy status and the existing `portal-files` bucket.
The production check then passed a private upload/download, shared Redis ping,
SMTP authentication and all 19 migration checksums. The approved test email was
accepted once and the next build skipped it using its audit reservation.
The final Storage check also exercises the signed browser upload path and
requires anonymous downloads to fail. No credentials were replaced or files moved.
