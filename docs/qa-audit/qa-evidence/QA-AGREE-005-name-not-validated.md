# QA-AGREE-005 — Agreement e-sign accepts a non-matching name

**Severity:** P3 (P2 if legal-grade) · **URL:** /agreements · **Role:** Mentee (Segun Diallo) · **Lang:** EN · 2026-07-24

## Repro
1. As mentee "Segun Diallo", open the Mentoring Agreement.
2. Type **"Wrong Name QA"** (not the signer's name) in "Type your full name to sign".
3. Check the consent box, click **Sign agreement**.

## Observed
Agreement signs successfully → "Signed: 2026-07-24 / Download PDF". The recorded signer name is the arbitrary "Wrong Name QA".

## Source
`src/features/agreements/actions.ts:19`
```ts
typedName: z.string().trim().min(2).max(120),  // no match against the signer's identity
```
Comment: "The typed name IS the e-signature; require something deliberate." — deliberate free-text signature.

## Nuance (what IS correct)
- Only an accepted-pair participant may sign (`match … OR mentorId/menteeId = user.id`).
- One signature per type (`CONFLICT` if already signed).
- Consent required (`z.literal('on')`).
- Audit log records the real `actorId` (Segun), not the typed name.

## Defect
The displayed/PDF signature name is unvalidated, so it can be arbitrary — weak signature integrity on a legal/confidentiality agreement, and it contradicts the brief's "incorrect name" expectation.

## Fix
Validate typed name against profile name (case/space-insensitive), or render the account name as the signature.
