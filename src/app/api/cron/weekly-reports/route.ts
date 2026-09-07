import { runWeeklyReportCron } from '@/features/reports/cron';
import { reportError } from '@/lib/observability/report';

// Machine-to-machine entry point for the weekly engagement report (CLAUDE.md
// §9.8, §13). Outside the auth matcher, so it authenticates with the shared
// CRON_SECRET:
//   Authorization: Bearer <CRON_SECRET>
//
// Scheduled DAILY in vercel.json; the job itself enforces "once per ISO week"
// (features/reports/weekly.ts), which also means a missed day catches up
// instead of losing the week. Vercel's Hobby plan permits nothing more frequent
// than daily anyway.
//
// Nothing leaves the portal here: the report is an internal admin artefact, so
// unlike the newsletter cron there is no human send gate — it is generated and
// the admins are notified.

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
    const result = await runWeeklyReportCron();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    reportError(error, { job: 'cron/weekly-reports' });
    return new Response('Job failed', { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
