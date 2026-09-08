import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type { CertificateData, CertificateLanguage } from './data';

const PAGE = { width: 841.89, height: 595.28 }; // A4 landscape, points
const BRAND = {
  ink: rgb(23 / 255, 38 / 255, 29 / 255),
  forest: rgb(18 / 255, 63 / 255, 34 / 255),
  green: rgb(31 / 255, 115 / 255, 56 / 255),
  gold: rgb(168 / 255, 120 / 255, 46 / 255),
  goldSoft: rgb(217 / 255, 193 / 255, 142 / 255),
  ivory: rgb(252 / 255, 250 / 255, 243 / 255),
  muted: rgb(92 / 255, 105 / 255, 95 / 255),
};

const COPY = {
  EN: {
    eyebrow: 'BLAK MOH MENTORSHIP PROGRAMME',
    title: 'Certificate of Completion',
    previewTitle: 'Certificate Preview',
    presentedTo: 'THIS CERTIFICATE IS PROUDLY PRESENTED TO',
    roleMentee: 'MENTEE',
    roleMentor: 'MENTOR',
    menteeBody: (programme: string, cohort: string) =>
      `for successfully completing ${programme} (${cohort}) and demonstrating commitment to growth, leadership and measurable development.`,
    mentorBody: (programme: string, cohort: string) =>
      `in recognition of dedicated service as a mentor in ${programme} (${cohort}), guiding emerging leaders with commitment, wisdom and generosity.`,
    completionDate: 'Completion date',
    certificateId: 'Certificate ID',
    programmeDirector: 'PROGRAMME DIRECTOR',
    coordinator: 'AUTHORIZED COORDINATOR',
    preview: 'PREVIEW - NOT YET ISSUED',
  },
  FR: {
    eyebrow: 'PROGRAMME DE MENTORAT BLAK MOH',
    title: "Certificat d'achèvement",
    previewTitle: 'Aperçu du certificat',
    presentedTo: 'CE CERTIFICAT EST FIÈREMENT DÉCERNÉ À',
    roleMentee: 'MENTORÉ(E)',
    roleMentor: 'MENTOR',
    menteeBody: (programme: string, cohort: string) =>
      `pour avoir achevé avec succès ${programme} (${cohort}) et fait preuve d'engagement envers sa croissance, son leadership et son développement mesurable.`,
    mentorBody: (programme: string, cohort: string) =>
      `en reconnaissance de son engagement comme mentor dans le cadre de ${programme} (${cohort}) et de son accompagnement généreux et éclairé des leaders émergents.`,
    completionDate: "Date d'achèvement",
    certificateId: 'Numéro du certificat',
    programmeDirector: 'DIRECTION DU PROGRAMME',
    coordinator: 'COORDINATION AUTORISÉE',
    preview: 'APERÇU - NON ENCORE DÉLIVRÉ',
  },
} as const;

function compatibleText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–|—/g, '-');
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = compatibleText(text).split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color = BRAND.ink,
) {
  const safe = compatibleText(text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: (PAGE.width - width) / 2, y, font, size, color });
}

function fitName(name: string, font: PDFFont): number {
  for (let size = 32; size >= 20; size -= 1) {
    if (font.widthOfTextAtSize(compatibleText(name), size) <= 650) return size;
  }
  return 20;
}

function formatDate(value: string, lang: CertificateLanguage): string {
  return new Intl.DateTimeFormat(lang === 'FR' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function drawLogo(
  page: PDFPage,
  logo: PDFImage,
  y: number,
  maxWidth: number,
  maxHeight: number,
) {
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height);
  const width = logo.width * scale;
  const height = logo.height * scale;
  page.drawImage(logo, {
    x: (PAGE.width - width) / 2,
    y: y - height,
    width,
    height,
  });
}

function drawCorner(
  page: PDFPage,
  x: number,
  y: number,
  sx: number,
  sy: number,
) {
  page.drawLine({
    start: { x, y },
    end: { x: x + 62 * sx, y },
    thickness: 1.8,
    color: BRAND.gold,
  });
  page.drawLine({
    start: { x, y },
    end: { x, y: y + 62 * sy },
    thickness: 1.8,
    color: BRAND.green,
  });
  page.drawLine({
    start: { x: x + 10 * sx, y: y + 10 * sy },
    end: { x: x + 35 * sx, y: y + 35 * sy },
    thickness: 0.7,
    color: BRAND.goldSoft,
  });
}

export async function renderCertificatePdf(
  data: CertificateData,
  lang: CertificateLanguage,
): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(
    `${data.earned ? 'Certificate' : 'Certificate preview'} - ${data.recipientName}`,
  );
  document.setAuthor('BLAK MOH');
  document.setSubject(`${data.programmeName} - ${data.cohortName}`);
  document.setKeywords(['BLAK MOH', 'mentorship', 'certificate']);
  document.setCreator('BLAK MOH Mentorship Portal');
  document.setProducer('BLAK MOH Mentorship Portal');

  const page = document.addPage([PAGE.width, PAGE.height]);
  const serif = await document.embedFont(StandardFonts.TimesRoman);
  const serifBold = await document.embedFont(StandardFonts.TimesRomanBold);
  const sans = await document.embedFont(StandardFonts.Helvetica);
  const sansBold = await document.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await readFile(
    join(process.cwd(), 'public', 'brand', 'blak-moh-original.png'),
  );
  const markBytes = await readFile(
    join(process.cwd(), 'public', 'brand', 'blak-moh-mark.png'),
  );
  const logo = await document.embedPng(logoBytes);
  const mark = await document.embedPng(markBytes);
  const t = COPY[lang];

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE.width,
    height: PAGE.height,
    color: BRAND.ivory,
  });
  page.drawRectangle({
    x: 18,
    y: 18,
    width: PAGE.width - 36,
    height: PAGE.height - 36,
    borderColor: BRAND.forest,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 27,
    y: 27,
    width: PAGE.width - 54,
    height: PAGE.height - 54,
    borderColor: BRAND.gold,
    borderWidth: 0.8,
  });
  drawCorner(page, 18, PAGE.height - 18, 1, -1);
  drawCorner(page, PAGE.width - 18, PAGE.height - 18, -1, -1);
  drawCorner(page, 18, 18, 1, 1);
  drawCorner(page, PAGE.width - 18, 18, -1, 1);

  drawLogo(page, logo, 548, 220, 62);
  drawCentered(page, t.eyebrow, 478, sansBold, 7.5, BRAND.gold);
  drawCentered(
    page,
    data.earned ? t.title : t.previewTitle,
    440,
    serifBold,
    26,
    BRAND.forest,
  );
  page.drawLine({
    start: { x: 347, y: 428 },
    end: { x: 397, y: 428 },
    thickness: 0.8,
    color: BRAND.goldSoft,
  });
  page.drawRectangle({
    x: 417.2,
    y: 425.2,
    width: 5.6,
    height: 5.6,
    borderColor: BRAND.gold,
    borderWidth: 0.8,
    rotate: degrees(45),
  });
  page.drawLine({
    start: { x: 445, y: 428 },
    end: { x: 495, y: 428 },
    thickness: 0.8,
    color: BRAND.goldSoft,
  });

  drawCentered(page, t.presentedTo, 397, sansBold, 7.5, BRAND.muted);
  const nameSize = fitName(data.recipientName, serifBold);
  drawCentered(page, data.recipientName, 350, serifBold, nameSize, BRAND.ink);
  drawCentered(
    page,
    data.role === 'mentee' ? t.roleMentee : t.roleMentor,
    328,
    sansBold,
    8,
    BRAND.green,
  );

  const body =
    data.role === 'mentee'
      ? t.menteeBody(data.programmeName, data.cohortName)
      : t.mentorBody(data.programmeName, data.cohortName);
  const bodyLines = wrapText(body, serif, 11.5, 620).slice(0, 4);
  bodyLines.forEach((line, index) =>
    drawCentered(
      page,
      line,
      290 - index * 17,
      serif,
      11.5,
      rgb(53 / 255, 70 / 255, 58 / 255),
    ),
  );

  const signatureY = 145;
  page.drawLine({
    start: { x: 105, y: signatureY },
    end: { x: 300, y: signatureY },
    thickness: 0.65,
    color: BRAND.muted,
  });
  page.drawLine({
    start: { x: 542, y: signatureY },
    end: { x: 737, y: signatureY },
    thickness: 0.65,
    color: BRAND.muted,
  });
  drawCenteredInRange(
    page,
    t.programmeDirector,
    105,
    300,
    130,
    sansBold,
    7.2,
    BRAND.muted,
  );
  drawCenteredInRange(
    page,
    t.coordinator,
    542,
    737,
    130,
    sansBold,
    7.2,
    BRAND.muted,
  );
  const markScale = Math.min(58 / mark.width, 58 / mark.height);
  page.drawCircle({
    x: PAGE.width / 2,
    y: 147,
    size: 38,
    borderColor: BRAND.goldSoft,
    borderWidth: 0.8,
    color: rgb(1, 1, 1),
    opacity: 0.55,
  });
  page.drawImage(mark, {
    x: PAGE.width / 2 - (mark.width * markScale) / 2,
    y: 147 - (mark.height * markScale) / 2,
    width: mark.width * markScale,
    height: mark.height * markScale,
  });

  const dateText = `${t.completionDate}: ${formatDate(data.issuedDate, lang)}`;
  const idText = `${t.certificateId}: ${data.certificateId}`;
  page.drawText(compatibleText(dateText), {
    x: 58,
    y: 66,
    font: sans,
    size: 7.6,
    color: BRAND.muted,
  });
  page.drawText(compatibleText(idText), {
    x: PAGE.width - 58 - sans.widthOfTextAtSize(compatibleText(idText), 7.6),
    y: 66,
    font: sans,
    size: 7.6,
    color: BRAND.muted,
  });

  if (!data.earned) {
    const text = compatibleText(t.preview);
    const size = 34;
    const width = sansBold.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (PAGE.width - width) / 2,
      y: 245,
      font: sansBold,
      size,
      color: BRAND.gold,
      opacity: 0.14,
      rotate: degrees(-18),
    });
  }

  return document.save({ useObjectStreams: true });
}

function drawCenteredInRange(
  page: PDFPage,
  text: string,
  left: number,
  right: number,
  y: number,
  font: PDFFont,
  size: number,
  color = BRAND.ink,
) {
  const safe = compatibleText(text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: left + (right - left - width) / 2,
    y,
    font,
    size,
    color,
  });
}
