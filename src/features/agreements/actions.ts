'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { AgreementType, Language, MatchStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/rbac';
import { writeAuditLog } from '@/lib/audit/audit';
import { notify } from '@/lib/notifications/notify';
import { getStorageProvider } from '@/lib/storage';
import { mapActionError, ok, fail, type ActionResult } from '@/lib/actions/result';
import { getAgreementTemplate } from './content';
import { renderAgreementPdf } from './pdf';

const signSchema = z.object({
  cohortId: z.string().cuid(),
  type: z.nativeEnum(AgreementType),
  // The typed name IS the e-signature; require something deliberate.
  typedName: z.string().trim().min(2).max(120),
  // Zod 4 replaced `errorMap` with `error`.
  consent: z.literal('on', { error: 'You must accept the terms to sign.' }),
});

function languageFor(locale: string): Language {
  return locale.toUpperCase().startsWith('FR') ? Language.FR : Language.EN;
}

/** Storage key for a signed agreement's PDF. */
function pdfKey(cohortId: string, agreementId: string): string {
  return `agreements/${cohortId}/${agreementId}.pdf`;
}

/**
 * E-sign an agreement (CLAUDE.md M2). Only a participant in an accepted pairing
 * may sign, each agreement type once. The exact wording is snapshotted into
 * terms_json and a PDF of the signature is rendered and stored. AI is not
 * involved — this is a human, legally meaningful action.
 */
export async function signAgreement(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const { cohortId, type, typedName } = signSchema.parse({
      cohortId: formData.get('cohortId'),
      type: formData.get('type'),
      typedName: formData.get('typedName'),
      consent: formData.get('consent'),
    });

    // Authorize: the signer must be in an accepted pairing in this cohort.
    const match = await prisma.match.findFirst({
      where: {
        cohortId,
        status: MatchStatus.ACCEPTED,
        deletedAt: null,
        OR: [{ mentorId: user.id }, { menteeId: user.id }],
      },
      include: {
        mentor: { select: { id: true, name: true } },
        mentee: { select: { id: true, name: true } },
      },
    });
    if (!match) {
      return fail({
        code: 'FORBIDDEN',
        message: 'You need an active pairing before you can sign agreements.',
      });
    }

    // One signature per type per cohort (no DB unique constraint because of the
    // soft-delete column; enforced here instead).
    const existing = await prisma.agreement.findFirst({
      where: { signedById: user.id, cohortId, type, deletedAt: null },
    });
    if (existing) {
      return fail({ code: 'CONFLICT', message: 'You have already signed this agreement.' });
    }

    // QA-AGREE-005: the typed name IS the signature, but it must match the
    // signer's registered name (case/whitespace-insensitive). An e-signature that
    // accepts an arbitrary name has no integrity on a legal/confidentiality record.
    const signerName = match.mentorId === user.id ? match.mentor.name : match.mentee.name;
    const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (signerName && normalizeName(typedName) !== normalizeName(signerName)) {
      return fail({
        code: 'VALIDATION',
        message: `Please sign with your full name as registered: ${signerName}.`,
        fieldErrors: { typedName: [`Enter your full name as registered: ${signerName}.`] },
      });
    }

    // QA-I18N-006: snapshot the agreement in the locale the signer is actually
    // viewing (header switcher), not their stored account locale.
    const lang = languageFor(await getLocale());
    const template = getAgreementTemplate(type, lang);
    const counterpartName = match.mentorId === user.id ? match.mentee.name : match.mentor.name;
    const signedAt = new Date();

    // Record the signature first so the row id can key its PDF; the terms snapshot
    // freezes exactly what was agreed (CLAUDE.md §5 terms_json).
    const agreement = await prisma.agreement.create({
      data: {
        cohortId,
        type,
        signedById: user.id,
        signedAt,
        terms: {
          version: template.version,
          lang,
          title: template.title,
          intro: template.intro,
          commitments: template.commitments,
          consent: template.consent,
          signerName: typedName,
          counterpartName: counterpartName ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    // Render + store the PDF, then link it. A storage failure leaves the
    // signature intact (the PDF can be regenerated) rather than losing consent.
    const key = pdfKey(cohortId, agreement.id);
    try {
      const bytes = await renderAgreementPdf({ template, signerName: typedName, counterpartName, signedAt, lang });
      await getStorageProvider().put({ key, bytes, contentType: 'application/pdf' });
      await prisma.agreement.update({ where: { id: agreement.id }, data: { pdfUrl: key } });
    } catch (pdfError) {
      console.error('[agreements] PDF generation/storage failed', pdfError);
    }

    await writeAuditLog({
      actorId: user.id,
      cohortId,
      action: 'agreement.signed',
      entityType: 'Agreement',
      entityId: agreement.id,
      metadata: { type, role: match.mentorId === user.id ? 'mentor' : 'mentee' },
    });

    // Tell the counterpart their pair signed so it reflects on their side and
    // prompts them to sign theirs (§1.10).
    const counterpartId = match.mentorId === user.id ? match.mentee.id : match.mentor.id;
    await notify({
      userId: counterpartId,
      type: 'agreement_signed',
      params: { name: typedName },
      link: '/agreements',
      cohortId,
    });

    revalidatePath('/agreements');
    return ok({ id: agreement.id });
  } catch (error) {
    return mapActionError(error);
  }
}

// useActionState adapter (prevState, formData) → ActionResult.
export type SignAgreementState = ActionResult<{ id: string }> | null;

export async function signAgreementForm(
  _prev: SignAgreementState,
  formData: FormData,
): Promise<SignAgreementState> {
  return signAgreement(formData);
}
