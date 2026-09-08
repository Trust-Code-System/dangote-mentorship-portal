# QA-INSIGHT-004 — Language-distribution donut uses two near-identical greens

**Severity:** P3 (accessibility / data-viz) · **URL:** /admin/insights · **Role:** Super Admin · **Env:** Prod · 2026-07-24

## Observation
The "Language distribution" donut (EN vs FR) renders both categorical segments in closely-related greens (dark green EN, light green FR). Distinguishing the two segments and mapping them to the "EN / FR" legend is difficult, and the pairing is unlikely to pass colour-blind (deuteranopia/protanopia) differentiation for categorical data.

Screenshot captured in session (donut with two green arcs + green legend dots).

## Why it's a defect
Categorical series should use perceptually-distinct hues, not two shades of one hue. This is a WCAG-adjacent usability issue (colour is the only channel distinguishing the categories).

## Recommended fix
Use two distinct hues for categorical series (e.g., brand green + a secondary/neutral brand colour), and validate with a colour-blindness simulator. Applies to any other single-hue categorical chart (check "Matching status" / "Training completion" bars too).
