import Link from 'next/link';
import { notFound } from 'next/navigation';
import { assertCohortAccess, requireRole } from '@/lib/auth/rbac';
import { ADMIN_ROLES } from '@/lib/auth/roles';
import { getFormDefinition } from '@/features/forms/data';
import { ReviewForm } from '@/features/reviews/review-form';

export default async function FormPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(ADMIN_ROLES);
  const form = await getFormDefinition((await params).id);
  if (!form) notFound();
  assertCohortAccess(user, form.cohortId);
  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <Link href={`/admin/forms?cohort=${form.cohortId}`} className="text-sm underline">
        Back to forms
      </Link>
      <div className="space-y-2">
        <h1 className="text-h1 font-semibold">{form.title}</h1>
        <p className="bg-muted rounded-md p-3 text-sm">
          Form preview. You can explore the questions; answers are not saved or submitted.
        </p>
      </div>
      <ReviewForm
        formId={form.id}
        cohortId={form.cohortId}
        type={form.type}
        fields={form.schema.fields}
        lang="EN"
        preview
      />
    </section>
  );
}
