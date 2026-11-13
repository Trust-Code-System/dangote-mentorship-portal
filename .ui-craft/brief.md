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

## Owner refinement — sign-in and motion
The root remains sign-in, with no public-page detour or auth logo linking to `/welcome`. Existing information routes remain reachable; no further marketing-page development is needed. The identity panel becomes a forest composition with fine contour lines, layered growth forms and connected programme steps. The form stays compact and starts near the header. Workspace content starts 20px beneath the header.

- Pinterest split login reference: https://www.pinterest.com/pin/1104789352379209050/ — identity panel and focused form column; transformed into our original programme illustration and original logos.
- Pinterest journey reference: https://www.pinterest.com/pin/833377106079421646/ — dimensional identity material and small context cards, observed in search results.
- X media search for login page design was inspected alongside the existing Marcel onboarding reference.
- React Bits Animated Content: https://reactbits.dev/animations/animated-content — adapted mount reveal, 10px distance / 550ms / 55ms stagger, visible server HTML.
- React Bits Count Up: https://reactbits.dev/text-animations/count-up — adapted numeric metric interpolation over 800ms, final values always available to assistive technology.
- React Bits Staggered Menu: https://reactbits.dev/components/staggered-menu — section staggering and smooth opening/closing principles applied to the existing accessible navigation.
- Certificate form selects use the same shared animated Radix primitive, preserving named form values and keyboard support.
Shared popovers use 380ms entry / 280ms exit; sidebar 480ms; page content 550ms. Menus stay mounted through exit and become inert immediately on close. Dialog/select primitives retain their Radix focus and keyboard behaviour. Reduced motion removes transitions and reveals immediately. These timings supersede the earlier 160–220ms collapse and no-entrance direction.

Control borders are quieter. Pointer interaction leaves no persistent green ring; keyboard users retain a neutral slate focus indicator. Application authentication, role grants and rate limiting remain unchanged.
