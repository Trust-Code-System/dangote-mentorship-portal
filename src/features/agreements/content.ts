import { AgreementType, Language } from '@prisma/client';

// Canonical agreement texts (CLAUDE.md §5: digital mentoring + confidentiality
// agreements). Bilingual (EN/FR) so a French user is never forced into English
// (CLAUDE.md §16). The exact text signed is snapshotted into Agreement.terms at
// signing time, so later edits to these templates never alter past signatures.
// Bump AGREEMENT_VERSION whenever the wording changes.
export const AGREEMENT_VERSION = '2026-v1';

export interface AgreementTemplate {
  version: string;
  title: string;
  /** Intro paragraphs shown before the commitments. */
  intro: string[];
  /** Bulleted commitments the signer accepts. */
  commitments: string[];
  /** Consent line shown next to the signature checkbox. */
  consent: string;
}

type TemplateMap = Record<AgreementType, Record<Language, AgreementTemplate>>;

const TEMPLATES: TemplateMap = {
  [AgreementType.MENTORING]: {
    [Language.EN]: {
      version: AGREEMENT_VERSION,
      title: 'Mentoring Agreement',
      intro: [
        'This agreement sets out how we will work together during the 9-month Dangote Mentorship Programme. It is a shared commitment between mentor and mentee, entered into freely by both.',
      ],
      commitments: [
        'We will meet regularly — at least once a month — and give each other reasonable notice when a session must be rescheduled.',
        'We will agree clear, measurable goals and review progress together at each session.',
        'We will be honest, respectful, and prepared, and we will keep what we share confidential.',
        'We will log our sessions in the portal and complete the mid-term and final reviews.',
        'Either of us may raise concerns with a programme administrator at any time, including a request to end or change the pairing.',
      ],
      consent: 'I have read and understood this Mentoring Agreement and I agree to its terms.',
    },
    [Language.FR]: {
      version: AGREEMENT_VERSION,
      title: 'Accord de mentorat',
      intro: [
        "Cet accord définit la manière dont nous travaillerons ensemble pendant les 9 mois du Dangote Mentorship Programme. Il s'agit d'un engagement partagé entre le mentor et le mentoré, conclu librement par les deux parties.",
      ],
      commitments: [
        'Nous nous rencontrerons régulièrement — au moins une fois par mois — et nous nous préviendrons raisonnablement à l’avance lorsqu’une séance doit être reportée.',
        'Nous fixerons des objectifs clairs et mesurables et examinerons les progrès ensemble à chaque séance.',
        'Nous serons honnêtes, respectueux et préparés, et nous garderons confidentiel ce que nous partageons.',
        'Nous consignerons nos séances dans le portail et compléterons les évaluations de mi-parcours et finale.',
        'Chacun de nous peut à tout moment faire part de ses préoccupations à un administrateur du programme, y compris une demande de fin ou de modification du jumelage.',
      ],
      consent: "J'ai lu et compris cet accord de mentorat et j'en accepte les conditions.",
    },
  },
  [AgreementType.CONFIDENTIALITY]: {
    [Language.EN]: {
      version: AGREEMENT_VERSION,
      title: 'Confidentiality Agreement',
      intro: [
        'Trust is the foundation of mentorship. This agreement confirms how we will protect the privacy of what we discuss.',
      ],
      commitments: [
        'What is shared in our mentoring conversations stays between us, unless we both agree otherwise or disclosure is required to protect someone from harm.',
        'We will not share personal, sensitive, or business-confidential information outside this relationship.',
        'Programme administrators can see engagement activity (such as how often we meet) but not the content of our private messages or notes.',
        'These obligations continue after the programme ends.',
      ],
      consent:
        'I have read and understood this Confidentiality Agreement and I agree to its terms.',
    },
    [Language.FR]: {
      version: AGREEMENT_VERSION,
      title: 'Accord de confidentialité',
      intro: [
        'La confiance est le fondement du mentorat. Cet accord confirme comment nous protégerons la confidentialité de nos échanges.',
      ],
      commitments: [
        "Ce qui est partagé dans nos conversations de mentorat reste entre nous, sauf accord mutuel contraire ou si la divulgation est nécessaire pour protéger une personne d'un préjudice.",
        'Nous ne partagerons aucune information personnelle, sensible ou confidentielle d’affaires en dehors de cette relation.',
        'Les administrateurs du programme peuvent voir l’activité d’engagement (par exemple la fréquence de nos rencontres) mais pas le contenu de nos messages ou notes privés.',
        'Ces obligations se poursuivent après la fin du programme.',
      ],
      consent: "J'ai lu et compris cet accord de confidentialité et j'en accepte les conditions.",
    },
  },
};

export function getAgreementTemplate(type: AgreementType, lang: Language): AgreementTemplate {
  return TEMPLATES[type][lang];
}
