import { notFound } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/rbac';
import { getConfidentialReviewResponses } from '@/features/reviews/confidential';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ProgrammeConcernsPage({
  searchParams,
}: {
  searchParams?: Promise<{ before?: string }>;
}) {
  const user = await requireUser();
  const before = (await searchParams)?.before;
  if (before && !z.string().cuid().safeParse(before).success) notFound();
  const responses = await getConfidentialReviewResponses(user.id, before);
  if (responses === null) notFound();
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h1 className="text-h1 font-semibold">Confidential review follow-up</h1>
        <p className="text-muted-foreground text-sm">
          Restricted to designated programme coordinators. These answers are excluded from general
          reports and AI summaries. Viewing is recorded in the audit log.
        </p>
      </div>
      {!responses.length ? (
        <Card>
          <CardContent className="p-6">
            {before ? 'No more responses.' : 'No submitted confidential review responses yet.'}
          </CardContent>
        </Card>
      ) : null}
      {responses.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {r.respondent.name ?? 'Participant'} · {r.title}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {r.respondent.email} · {r.cohort} · {r.submittedAt?.toISOString().slice(0, 10)}
            </p>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {r.answers.map((a) => (
                <div key={a.label}>
                  <dt className="text-sm font-medium">{a.label}</dt>
                  <dd className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
                    {a.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      ))}
      <nav aria-label="Response pages" className="flex gap-4 text-sm">
        {before ? (
          <Link href="/programme-concerns" className="underline">
            Most recent responses
          </Link>
        ) : null}
        {responses.length === 50 ? (
          <Link href={`?before=${responses[responses.length - 1]!.id}`} className="underline">
            Older responses
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
