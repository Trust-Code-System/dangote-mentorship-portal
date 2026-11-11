# Dangote portal redesign

## Intent
Rebuild the visual experience across the existing site, preserving routes, role permissions, translations, data and actions. A precise, light workspace with forest accents, a quiet grey navigation rail, crisp white surfaces and distinct role priorities. Craft 9, motion 4, density 6, variance 5. Signature: a restrained inset active navigation pill and fine segmented progress details.

## Verified user constraints
The existing UI feels awkward and insufficiently sharp. Admin, mentor and mentee dashboards must be materially different. Replace the Dangote/green loading splash. Research the selected public X design references and adapt references separately for dashboards, forms and sign-in. Keep motion smooth and purposeful. The supplied original logos remain.

## Influence ledger
- https://x.com/thesamirho/status/2119610933366436283 — compact workspace hierarchy, neutral table chrome, connected operational metrics. Adapt for admin overview and tables.
- https://x.com/uiakanksha_/status/2119754041559507300 — measured typography, divided metric band, fine progress indicators. Adapt for the dashboard metric system and goal progress.
- https://x.com/marcelkargul/status/2119543293629612041 — quiet rail and inset white work area. Adapt for shared shell and mentor workspace.
- https://x.com/nizamdesign/status/2118581459808374874 — clear grouped form sections, white controls, deliberate footer actions. Adapt for forms, selects and dialogs.
- https://x.com/marcelkargul/status/2102435417249415190 — calm setup surface, narrow form measure, concise labels and supporting space. Adapt for authentication.
- https://x.com/Dharmeesh_dev/status/2119799672424349821 — collapsible rail and active pill feedback. Preserve our navigation semantics and reduced-motion behaviour.

## Page composition
Admin: programme context → operational metrics → engagement workspace and matching distribution → risk queue. Mentor: personal greeting and scheduling action → workload band → mentee roster and session agenda → match response and journey. Mentee: personal greeting → goal/action progress → development goals and session/mentor context → action list → journey. Auth: quiet light sign-in form with a separate muted identity panel, existing provider controls and error handling. Forms: shared field rhythm, precise labels, clear focus and disabled states. Other existing pages inherit shell, typography, controls, surfaces and table system.

## Loading and motion
Keep navigation shell mounted. Thin moving progress at the top; content-shaped skeletons for table, form, calendar, messages and dashboard routes. No pulsing or spinning brand mark, no artificial minimum delay. 160–220ms hover/collapse transitions; no large content entrance animation. All movement disabled with prefers-reduced-motion.

## Acceptance
Typecheck, lint, unit tests, production build. Verify three authenticated role dashboards, form and auth screens at desktop/mobile sizes; check navigation, loading, no horizontal overflow and keyboard focus. All data remains real; no invented chart history or fabricated progress. No production deploy or main-branch protection changes as part of the visual implementation.
