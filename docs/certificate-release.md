# Mentee certificate release

Mentee certificates are locked by default, including for existing participants who have completed training, approved goals and both reviews. There is no automatic approval or migration backfill.

In **Admin → Certificates**, select a mentee and open the preview. After the programme requirements are met, click **Mark passed and permit certificate**. The action records the administrator and approval timestamp against that accepted pairing. **Revoke certificate permission** clears the grant and locks subsequent access again. Both decisions are recorded in the audit log and require current admin role and cohort access.

Before release, the mentee page contains only a lock notice and progress checklist: no certificate artwork, printable preview or download link. Direct PDF requests, including preview and download query flags and other languages, return 403. Another participant's certificate remains inaccessible. Every download reads the current approval and completion records; PDF responses cannot be cached. Revocation cannot recall a file someone already downloaded while authorised.

Administrator previews remain visibly marked as unissued until release. Mentor certificate rules are unchanged. The journey tracker also waits for the mentee's explicit certificate approval before marking the certificate step complete.

The additive migration adds nullable approval fields and an approver foreign key. It does not issue certificates or change participant completion records. CI covers a completed mentee being denied, an authenticated admin approving release, a successful PDF download, and revocation denying it again, using only disposable local Postgres fixtures.
