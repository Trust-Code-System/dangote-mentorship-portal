# Demo pair enrolment: 2026/2027

The user requested moving BLAK MOH (`blakmoh06@gmail.com`, mentor) and Paul (`oluwadepo.paul@gmail.com`, mentee) into the active 2026/2027 Stream for the demo.

`scripts/move-demo-to-2026-2027.ts` defaults to a read-only plan. With `--apply`, it moves their existing profiles, restores or creates only their corresponding target-cohort participant grants, retires the old cohort grants, closes the old accepted pairing as OVERRIDDEN and creates/restores their accepted pairing in the new stream. It requires the expected active target, both existing profiles, the current global admin operator and no unexpected accepted pairings. The transaction records the previous enrolment and pairing in the audit log.

Previous goals, sessions, meetings and responses stay in their original cohort. Credentials, training results and certificate permissions are preserved; no invitation or email is sent. The new pairing starts without certificate permission. Do not repurpose this narrowly scoped operator script as a general bulk import tool.

Run from the intended application checkout and database environment:

```powershell
npx tsx --env-file=.env.local scripts/move-demo-to-2026-2027.ts
# After inspecting the exact plan:
npx tsx --env-file=.env.local scripts/move-demo-to-2026-2027.ts --apply
```

The invitation-page browser regression checks pending, expired, used and invalid links using disposable CI records and never activates an account or sends mail. A historical screenshot alone is not evidence of a current reproducible application fault; verify the current invitation state and browser behaviour before claiming a fix.
