import { runNewsletterCron } from '@/features/newsletters/cron';
import { reportError } from '@/lib/observability/report';

// Machine-to-machine entry point for the newsletter cadence (CLAUDE.md §10).
// Like /api/cron/notifications, this route is outside the auth matcher and
// authenticates with the shared CRON_SECRET:
//   Authorization: Bearer <CRON_SECRET>
//
// What it does NOT do is send anything an admin has not approved: the job
// prepares drafts on the scheduled days and dispatches only issues that already
// carry an approval (§16).
//
// vercel.json runs this DAILY (09:00 UTC / 10:00 Lagos) because Vercel's Hobby
// plan rejects any cron more frequent than once a day at deploy time. The
// schedule logic is built for that: isDraftDue() catches up a scheduled day
// whose send hour fell after the daily run, so nothing is lost. Running it more
// often (on Pro, or from an on-prem scheduler) simply makes drafts appear closer
// to their chosen hour — the work is idempotent, so a missed or repeated tick is
// safe either way.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response('Cron is not configured', { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await runNewsletterCron();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    reportError(error, { job: 'cron/newsletters' });
    return new Response('Job failed', { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
