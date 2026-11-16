# Dangote Mentorship 2026/2027

The owner confirmed a 16 November 2026 start, no programme end date yet, and English only. This stream uses its own programme, cohort, forms and coordinator grants; existing participant memberships and older form responses are preserved.

## Form mapping

| Participant | Form | Source | Portal flow |
| --- | --- | --- | --- |
| Mentee | Goal setting | Goal Setting Form updated.docx | Goals, with primary goals saved separately and the mentor approving through their own account |
| Mentee | Monthly review | Existing standard monthly meeting form | Monthly form, with a non-gating November 2026 window |
| Mentee | Mid-term review | C1 source document | 29 source questions, expanded to 62 fields including every matrix and goal row |
| Mentor | Mid-term review | C2 source document | 31 source questions, expanded to 64 fields; separate responses for each accepted mentee |
| Mentee | Final review | D1 source document | 27 source questions, expanded to 60 fields |
| Mentor | Final review | D2 source document | 25 source questions, expanded to 52 fields; separate responses for each accepted mentee |

The two supplied D2 files are byte-identical and produce one mentor final form. Source filenames and SHA-256 hashes for the review documents are recorded in `src/features/forms/phase2-2026-2027.json`. Internal reviewer notes, blank approval/signature tables for the programme team, draft status text and indicative March/June dates are not participant questions. No external approval or signature is inferred from those documents.

The updated goal form captures basic information, key actions, deadline, success indicators, mentor support, challenges, commitment, review cadence, next review date and mentee digital acceptance. The existing authenticated mentor approval records mentor sign-off; a mentee cannot sign on a mentor's behalf. Optional Goal 2 is another goal record using the same workflow, so both appear in progress tracking.

## Confidential follow-up

Only accounts explicitly granted `review_concerns_reader:<userId>` in this cohort can open `/programme-concerns`. An ordinary administrator has no automatic grant. The owner named the two existing coordinator accounts during setup; the release tool takes their emails as explicit arguments and grants only this narrow access, without adding administrator roles.

Confidential fields and identity fields are excluded from general review aggregates and AI prompts. Confidential access is audited without recording answer bodies in the audit log. Form editing preserves grouping, source-question identifiers and privacy metadata, and cannot silently downgrade an existing confidential field to a reportable one. No review response triggers an automatic email, recognition decision, case-study publication or external message.

## Release operation

Run the setup script with the application's intended database environment. It defaults to a read-only plan and verifies that the operator is an existing global super-admin and both named recipients already have accounts.

```powershell
npx tsx --env-file=.env.local scripts/setup-2026-2027.ts --actor=<operator-email> --readers=<coordinator-email>,<coordinator-email>
```

After inspecting the plan, `--apply` stages the programme/cohort as drafts and creates only missing forms. After releasing and verifying the compatible application version, `--apply --activate` activates the stream and its November monthly form. The additive migration adds goal-setting JSON and the mentor review's mentee subject key; it does not rewrite existing responses.

The script refuses to replace a different existing form, rejects date/language differences on an existing target stream, and does not invent participants, accept matches or send invitations. Future review windows and programme-end dates remain unconfigured until confirmed.

## Verification

Source coverage, date/declaration validation, goal sign-off readiness, confidential access and exclusion, role/cohort authorization, and per-mentee response partitioning have focused unit coverage. CI browser tests use only disposable local Postgres fixtures to inspect all four document forms, the goal preview, stream selection and denial of confidential access to an unlisted administrator. Preview pages disable saving, submission and draft autosave.
