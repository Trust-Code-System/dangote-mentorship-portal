import Link from 'next/link';
import { requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { GoalForm } from '@/app/(dashboard)/goals/goal-form';

export default async function GoalSettingPreviewPage() {
  await requireRole(ADMIN_ROLES);
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/forms" className="text-sm underline">
        Back to forms
      </Link>
      <h1 className="text-h1 font-semibold">Goal-setting form — 2026/2027</h1>
      <p className="bg-muted rounded-md p-3 text-sm">
        Preview of the updated goal-setting form. A mentee saves each primary goal in Goals, then
        submits it for their mentor to approve. Optional Goal 2 uses the same form. Preview entries
        are not saved.
      </p>
      <GoalForm mode="create" extended preview />
    </section>
  );
}
