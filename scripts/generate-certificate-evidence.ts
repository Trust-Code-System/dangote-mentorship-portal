import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderCertificatePdf } from '../src/features/certificate/pdf';
import {
  createCertificateId,
  type CertificateRole,
} from '../src/features/certificate/id';
import type {
  CertificateData,
  CertificateLanguage,
} from '../src/features/certificate/data';

const outputDirectory = join(process.cwd(), 'certificate-evidence');

function safeCertificate(
  recipientName: string,
  role: CertificateRole,
  lang: CertificateLanguage,
): CertificateData {
  const matchId = `safe-evidence-${lang.toLowerCase()}-${role}`;
  return {
    matchId,
    cohortId: 'safe-demo-cohort',
    recipientId: `safe-${role}`,
    recipientName,
    recipientLocale: lang,
    role,
    programmeName:
      lang === 'FR'
        ? 'Programme de mentorat BLAK MOH'
        : 'BLAK MOH Mentorship Programme',
    cohortName:
      lang === 'FR' ? 'Cohorte Leadership 2026' : 'Leadership Cohort 2026',
    counterpartName: lang === 'FR' ? 'Aminata Koné' : 'Amina Bello',
    earned: true,
    eligibility: {
      trainingCompleted: true,
      goalApproved: true,
      midtermSubmitted: true,
      finalSubmitted: true,
    },
    issuedDate: '2026-07-25',
    certificateId: createCertificateId(matchId, role, 2026),
  };
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const samples: Array<[string, CertificateData, CertificateLanguage]> = [
    [
      'sample-certificate-en.pdf',
      safeCertificate("Alexandra Chukwuemeka-Davies O'Connell", 'mentee', 'EN'),
      'EN',
    ],
    [
      'sample-certificate-fr.pdf',
      safeCertificate("Élodie-Anne N'Diaye Kouamé", 'mentor', 'FR'),
      'FR',
    ],
  ];

  for (const [filename, data, lang] of samples) {
    const bytes = await renderCertificatePdf(data, lang);
    await writeFile(join(outputDirectory, filename), bytes);
    console.log(`${filename}: ${bytes.byteLength} bytes`);
  }
}

await main();
