# Assessment tab removal — 25 November 2026

The programme owner requested removal of the participant Assessment tab for the
2026/2027 stream. This supersedes the quarterly restoration performed on
20 November. Monthly meeting forms, mid-term reviews and final reviews remain
available.

The change uses the existing per-stream `quarterly_assessments_disabled` policy.
For cohort `cmwixp7uh0002fi8g8u0june4`, the production flag is enabled and all
four quarterly windows are inactive with `gatesAccess: false`. Form definitions
and historical responses are retained. Other streams are unchanged.

The existing policy removes the participant navigation item, redirects direct
visits to `/assessment`, excludes quarterly obligations from the access gate,
and blocks quarterly submissions and reactivation. Inactive windows are
excluded from reminders and engagement obligations. The Monthly form remains
available to both mentors and mentees.

Production database verification confirmed the disabled flag, zero active
quarterly windows, unchanged non-quarterly windows, and unchanged form and
response counts. The configured production database target was rechecked
against Vercel. No code deployment was required for this setting change.

Validation: 21 existing policy, action, gate and mentor-menu checks passed.
Live visual verification was limited by rejected saved participant logins;
no passwords were changed during this removal.

Do not rerun the earlier restoration operation without a new programme-owner
request. Administrative history and form definitions remain available for
recordkeeping; this change removes the participant assessment experience.
