# QA-I18N-006 — French selection leaves agreement content in English

**Severity:** P2 · **URL:** /agreements · **Role:** Mentee (Segun Diallo) · **Lang:** FR · 2026-07-24

## Repro
1. As mentee, open `/agreements`.
2. Click **Français** in the header.

## Observed
- UI chrome DID translate: nav = "Tableau de bord / Mon binôme / Objectifs / Séances / Plus", search = "Rechercher…", field = "Saisissez votre nom complet pour signer", button = "Signer l'accord".
- Agreement CONTENT did NOT translate: title "Confidentiality Agreement", intro "Trust is the foundation of mentorship…", all body bullets, and the consent checkbox "I have read and understood this Confidentiality Agreement and I agree to its terms." remained in **English**.

## Why it's a defect
Mixed EN/FR interface on a legal document; a French user is asked to read/sign English terms. Violates CLAUDE.md §16 ("Don't force French users into English anywhere") and Phase 22 ("No mixed English/French interface").

## Likely root cause
Agreement content = `getAgreementTemplate(type, languageFor(user.locale))` (saved account locale), while the header switcher changes only the next-intl UI locale. The two are decoupled.

## Fix
Drive content language from the active UI locale (or persist the toggle to `user.locale`); re-check goals/reviews/notifications for the same UI-vs-content split.
