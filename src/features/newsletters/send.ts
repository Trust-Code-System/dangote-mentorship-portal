import 'server-only';
import { NewsletterStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/mail';
import { reportError } from '@/lib/observability/report';
import { listCohortRecipients } from './data';
import { parseNewsletterBody, sendableSections } from './schema';
import { renderNewsletterHtml, renderNewsletterText } from './template';

// Newsletter dispatch (CLAUDE.md §10 "recipient tracking").
//
// Called only after a human approved the issue — never by the AI drafter and
// never by the schedule (§16). Each recipient gets the issue in their own
// language, and delivery is recorded per recipient so a partial failure is
// visible and the run can be retried without double-sending.

export interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
}

const PROGRAMME_NAME = 'BLAK MOH Mentorship Programme';

function portalUrl(): string | null {
  const base = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null;
  return base ? `${base.replace(/\/+$/, '')}/dashboard` : null;
}

const FOOTER = {
  EN: 'You are receiving this because you are enrolled in the mentorship programme.',
  FR: 'Vous recevez ce message car vous êtes inscrit au programme de mentorat.',
} as const;

/**
 * Send an approved newsletter. Idempotent per recipient: a NewsletterRecipient
 * row that already has `sentAt` is skipped, so re-running after a partial
 * failure only retries the ones that did not go out.
 */
export async function sendNewsletter(newsletterId: string): Promise<SendResult> {
  const newsletter = await prisma.newsletter.findFirst({
    where: { id: newsletterId, deletedAt: null },
    select: {
      id: true,
      cohortId: true,
      title: true,
      subjectEn: true,
      subjectFr: true,
      bodyJson: true,
      status: true,
      approvedAt: true,
      cohort: { select: { name: true } },
    },
  });
  if (!newsletter) throw new Error('Newsletter not found.');

  // Belt and braces: dispatch refuses anything a human has not approved.
  if (!newsletter.approvedAt) throw new Error('This newsletter has not been approved.');
  if (newsletter.status === NewsletterStatus.SENT) return { sent: 0, failed: 0, skipped: 0 };

  const body = parseNewsletterBody(newsletter.bodyJson);
  if (!body || sendableSections(body).length === 0) {
    throw new Error('This newsletter has no content to send.');
  }

  const recipients = await listCohortRecipients(newsletter.cohortId);
  const issueDate = new Date();

  // Materialize the recipient list first, so tracking exists even if the
  // process dies mid-send.
  if (recipients.length > 0) {
    await prisma.newsletterRecipient.createMany({
      data: recipients.map((recipient) => ({
        newsletterId: newsletter.id,
        userId: recipient.userId,
      })),
      skipDuplicates: true,
    });
  }

  const existing = await prisma.newsletterRecipient.findMany({
    where: { newsletterId: newsletter.id, deletedAt: null },
    select: { id: true, userId: true, sentAt: true },
  });
  const rowByUser = new Map(existing.map((row) => [row.userId, row]));

  const result: SendResult = { sent: 0, failed: 0, skipped: 0 };

  for (const recipient of recipients) {
    const row = rowByUser.get(recipient.userId);
    if (row?.sentAt) {
      result.skipped += 1;
      continue;
    }

    const lang = recipient.locale;
    const subject =
      (lang === 'FR' ? newsletter.subjectFr : newsletter.subjectEn) ??
      newsletter.subjectEn ??
      newsletter.subjectFr ??
      newsletter.title;

    const meta = {
      subject,
      programmeName: PROGRAMME_NAME,
      cohortName: newsletter.cohort.name,
      issueDate: new Intl.DateTimeFormat(lang === 'FR' ? 'fr-FR' : 'en-GB', {
        dateStyle: 'long',
      }).format(issueDate),
      portalUrl: portalUrl(),
      footerNote: FOOTER[lang],
    };

    try {
      await sendEmail({
        to: recipient.email,
        subject,
        text: renderNewsletterText(body, lang, meta),
        html: renderNewsletterHtml(body, lang, meta),
      });
      if (row) {
        await prisma.newsletterRecipient.update({
          where: { id: row.id },
          data: { sentAt: new Date() },
        });
      }
      result.sent += 1;
    } catch (error) {
      // One bad address must not stop the issue. Record and continue; the row
      // keeps sentAt null so a retry picks it up.
      reportError(error, { job: 'newsletter/send', newsletterId: newsletter.id });
      result.failed += 1;
    }
  }

  // Mark SENT when at least one went out; a run where everything failed stays
  // approved-and-scheduled so it can be retried.
  if (result.sent > 0) {
    await prisma.newsletter.update({
      where: { id: newsletter.id },
      data: { status: NewsletterStatus.SENT, sentAt: new Date() },
    });
  }

  return result;
}
