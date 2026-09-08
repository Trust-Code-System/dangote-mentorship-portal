import { ReviewType, RoleName } from '@prisma/client';
import { formSchemaShape, type FormSchemaShape } from './schema';

// ──────────────────────────────────────────────────────────────────────────
// The programme's standard question sets, transcribed from the source
// documents (the Monthly Meeting Form and the two mid-point assessments).
//
// This is the SINGLE SOURCE OF TRUTH for those question sets. Both the local
// seed and the admin "install standard question sets" action read from here, so
// a cohort set up by an admin gets byte-identical questions to a seeded one and
// neither can drift from the documents.
//
// Forms are per-cohort by design (admins may edit them without a code change),
// which means every new cohort needs its own copies. Retyping 37 questions in
// two languages per cohort is not a real option, hence the installer.
// ──────────────────────────────────────────────────────────────────────────

export interface StandardForm {
  type: ReviewType;
  /** Which role answers this set. */
  roleName: RoleName;
  title: string;
  fields: FormSchemaShape['fields'];
}

// Option lists shared by more than one set, so the wording cannot diverge
// between the mentor and mentee versions of the same question.
const MENTEE_FREQUENCY_OPTIONS = [
  { value: 'weekly', labelEn: 'Weekly', labelFr: 'Chaque semaine' },
  { value: 'biweekly', labelEn: 'Biweekly', labelFr: 'Toutes les deux semaines' },
  { value: 'monthly', labelEn: 'Monthly', labelFr: 'Chaque mois' },
  { value: 'less_often', labelEn: 'Less frequently', labelFr: 'Moins souvent' },
];

const PROGRESS_OPTIONS = [
  { value: 'significant', labelEn: 'Significant progress', labelFr: 'Progrès importants' },
  { value: 'some', labelEn: 'Some progress', labelFr: 'Quelques progrès' },
  { value: 'limited', labelEn: 'Limited progress', labelFr: 'Progrès limités' },
  { value: 'none', labelEn: 'No progress', labelFr: 'Aucun progrès' },
];

const QUARTERLY_MENTEE: StandardForm = {
  type: ReviewType.QUARTERLY,
  roleName: RoleName.MENTEE,
  title: 'Quarterly assessment — mentee',
  fields: [
      {
        id: 'meet_frequency',
        labelEn: 'How often do you meet or interact with your mentor?',
        labelFr: 'À quelle fréquence rencontrez-vous ou échangez-vous avec votre mentor ?',
        type: 'single_select',
        required: true,
        options: MENTEE_FREQUENCY_OPTIONS,
      },
      {
        id: 'relationship_quality',
        labelEn: 'How would you rate your relationship with your mentor?',
        labelFr: 'Comment évaluez-vous votre relation avec votre mentor ?',
        type: 'single_select',
        required: true,
        options: [
          { value: 'very_supportive', labelEn: 'Very supportive', labelFr: 'Très soutenante' },
          { value: 'supportive', labelEn: 'Supportive', labelFr: 'Soutenante' },
          { value: 'neutral', labelEn: 'Neutral', labelFr: 'Neutre' },
          { value: 'unsupportive', labelEn: 'Unsupportive', labelFr: 'Peu soutenante' },
        ],
      },
      {
        id: 'goal_clarity',
        labelEn: "How clear are the goals you're working on with your mentor?",
        labelFr: 'Les objectifs que vous poursuivez avec votre mentor sont-ils clairs ?',
        type: 'single_select',
        required: true,
        options: [
          { value: 'very_clear', labelEn: 'Very clear', labelFr: 'Très clairs' },
          { value: 'clear', labelEn: 'Clear', labelFr: 'Clairs' },
          { value: 'somewhat_clear', labelEn: 'Somewhat clear', labelFr: 'Plutôt clairs' },
          { value: 'not_clear', labelEn: 'Not clear', labelFr: 'Pas clairs' },
        ],
      },
      {
        id: 'goal_progress',
        labelEn: 'Have you made progress on your mentorship goals so far?',
        labelFr: 'Avez-vous progressé vers vos objectifs de mentorat jusqu’ici ?',
        type: 'single_select',
        required: true,
        options: PROGRESS_OPTIONS,
      },
      {
        id: 'what_helped_most',
        labelEn: 'What has helped you the most in this mentorship process?',
        labelFr: 'Qu’est-ce qui vous a le plus aidé dans ce processus de mentorat ?',
        type: 'long_text',
        required: true,
      },
      {
        id: 'difficulties',
        labelEn: 'What has made achieving your goals difficult? Tick all that apply.',
        labelFr:
          'Qu’est-ce qui a rendu difficile l’atteinte de vos objectifs ? Cochez tout ce qui s’applique.',
        type: 'multi_select',
        required: false,
        options: [
          { value: 'time', labelEn: 'Time constraints', labelFr: 'Manque de temps' },
          {
            value: 'communication',
            labelEn: 'Lack of communication',
            labelFr: 'Manque de communication',
          },
          {
            value: 'expectations',
            labelEn: 'Unclear expectations',
            labelFr: 'Attentes floues',
          },
          { value: 'other', labelEn: 'Something else', labelFr: 'Autre chose' },
        ],
      },
      {
        id: 'difficulties_other',
        labelEn: 'If you ticked "something else" above, please say what',
        labelFr: 'Si vous avez coché « autre chose » ci-dessus, précisez',
        type: 'short_text',
        required: false,
      },
      {
        id: 'support_needed',
        labelEn:
          'What kind of support do you need to move forward more effectively? Tick all that apply.',
        labelFr:
          'De quel type de soutien avez-vous besoin pour avancer plus efficacement ? Cochez tout ce qui s’applique.',
        type: 'multi_select',
        required: true,
        options: [
          {
            value: 'mentor_engagement',
            labelEn: 'More engagement with my mentor',
            labelFr: 'Plus d’échanges avec mon mentor',
          },
          { value: 'goal_refinement', labelEn: 'Goal refinement', labelFr: 'Affiner les objectifs' },
          {
            value: 'coordinator_checkins',
            labelEn: 'More programme coordinator check-ins',
            labelFr: 'Plus de points avec la coordination du programme',
          },
          {
            value: 'peer_support',
            labelEn: 'Peer support or resources',
            labelFr: 'Soutien des pairs ou ressources',
          },
          { value: 'other', labelEn: 'Something else', labelFr: 'Autre chose' },
        ],
      },
      {
        id: 'support_needed_other',
        labelEn: 'If you ticked "something else" above, please say what',
        labelFr: 'Si vous avez coché « autre chose » ci-dessus, précisez',
        type: 'short_text',
        required: false,
      },
      {
        id: 'improvement_suggestions',
        labelEn:
          'What could improve the mentoring experience for the rest of the programme?',
        labelFr:
          'Qu’est-ce qui pourrait améliorer l’expérience de mentorat pour le reste du programme ?',
        type: 'long_text',
        required: false,
      },
  ],
};

const QUARTERLY_MENTOR: StandardForm = {
  type: ReviewType.QUARTERLY,
  roleName: RoleName.MENTOR,
  title: 'Quarterly assessment — mentor',
  fields: [
      {
        id: 'meeting_number',
        labelEn: 'Meeting number',
        labelFr: 'Numéro de la rencontre',
        type: 'short_text',
        required: false,
      },
      {
        id: 'meeting_duration',
        labelEn: 'Typical duration of your meetings',
        labelFr: 'Durée habituelle de vos rencontres',
        type: 'short_text',
        required: false,
      },
      {
        id: 'meet_frequency',
        labelEn: 'How often have you met with your mentee so far?',
        labelFr: 'À quelle fréquence avez-vous rencontré votre mentoré jusqu’ici ?',
        type: 'single_select',
        required: true,
        options: MENTEE_FREQUENCY_OPTIONS,
      },
      {
        id: 'interaction_quality',
        labelEn: 'How would you describe the quality of your interactions with your mentee?',
        labelFr: 'Comment décririez-vous la qualité de vos échanges avec votre mentoré ?',
        type: 'single_select',
        required: true,
        options: [
          { value: 'excellent', labelEn: 'Excellent', labelFr: 'Excellente' },
          { value: 'good', labelEn: 'Good', labelFr: 'Bonne' },
          { value: 'fair', labelEn: 'Fair', labelFr: 'Passable' },
          { value: 'poor', labelEn: 'Poor', labelFr: 'Faible' },
        ],
      },
      {
        id: 'mentee_engagement',
        labelEn: 'How engaged is your mentee in the process?',
        labelFr: 'Dans quelle mesure votre mentoré s’investit-il dans le processus ?',
        type: 'single_select',
        required: true,
        options: [
          { value: 'highly', labelEn: 'Highly engaged', labelFr: 'Très investi' },
          { value: 'moderately', labelEn: 'Moderately engaged', labelFr: 'Moyennement investi' },
          { value: 'minimally', labelEn: 'Minimally engaged', labelFr: 'Peu investi' },
          { value: 'not', labelEn: 'Not engaged', labelFr: 'Pas investi' },
        ],
      },
      {
        id: 'goals_focused',
        labelEn: 'What goals have you and your mentee focused on?',
        labelFr: 'Sur quels objectifs vous êtes-vous concentrés avec votre mentoré ?',
        type: 'long_text',
        required: true,
      },
      {
        id: 'mentee_progress',
        labelEn: 'What progress (if any) has your mentee made toward those goals?',
        labelFr: 'Quels progrès votre mentoré a-t-il réalisés vers ces objectifs, le cas échéant ?',
        type: 'single_select',
        required: true,
        options: PROGRESS_OPTIONS,
      },
      {
        id: 'progress_drivers',
        labelEn: 'In your view, what has contributed most to the progress or lack thereof?',
        labelFr: 'Selon vous, qu’est-ce qui explique le plus ces progrès ou leur absence ?',
        type: 'long_text',
        required: true,
      },
      {
        id: 'had_challenges',
        labelEn: 'Have you encountered any challenges as a mentor in this programme?',
        labelFr: 'Avez-vous rencontré des difficultés en tant que mentor dans ce programme ?',
        type: 'boolean',
        required: true,
      },
      {
        id: 'challenges_detail',
        labelEn: 'If yes, please describe briefly',
        labelFr: 'Si oui, décrivez brièvement',
        type: 'long_text',
        required: false,
      },
      {
        id: 'support_wanted',
        labelEn:
          'What additional support or resources would enhance your mentoring experience? Tick all that apply.',
        labelFr:
          'Quel soutien ou quelles ressources supplémentaires amélioreraient votre expérience de mentor ? Cochez tout ce qui s’applique.',
        type: 'multi_select',
        required: false,
        options: [
          { value: 'peer_support', labelEn: 'Peer support', labelFr: 'Soutien des pairs' },
          {
            value: 'templates',
            labelEn: 'More structured templates',
            labelFr: 'Des modèles plus structurés',
          },
          {
            value: 'coordinator_guidance',
            labelEn: 'Guidance from programme coordinators',
            labelFr: 'Accompagnement de la coordination du programme',
          },
          {
            value: 'skill_materials',
            labelEn: 'Skill-building materials',
            labelFr: 'Supports de développement de compétences',
          },
          { value: 'other', labelEn: 'Something else', labelFr: 'Autre chose' },
        ],
      },
      {
        id: 'support_wanted_other',
        labelEn: 'If you ticked "something else" above, please say what',
        labelFr: 'Si vous avez coché « autre chose » ci-dessus, précisez',
        type: 'short_text',
        required: false,
      },
      {
        id: 'programme_suggestions',
        labelEn: 'What changes, if any, would you recommend to improve the programme?',
        labelFr: 'Quels changements recommanderiez-vous, le cas échéant, pour améliorer le programme ?',
        type: 'long_text',
        required: false,
      },
      {
        id: 'additional_comments',
        labelEn: 'Additional comments',
        labelFr: 'Commentaires supplémentaires',
        type: 'long_text',
        required: false,
      },
  ],
};

const MONTHLY_MENTEE: StandardForm = {
  type: ReviewType.MONTHLY,
  roleName: RoleName.MENTEE,
  title: 'Monthly meeting form',
  fields: [
      {
        id: 'meeting_number',
        labelEn: 'Meeting number',
        labelFr: 'Numéro de la rencontre',
        type: 'short_text',
        required: true,
      },
      {
        id: 'meeting_duration',
        labelEn: 'Duration of the meeting',
        labelFr: 'Durée de la rencontre',
        type: 'short_text',
        required: true,
      },
      {
        id: 'main_topics',
        labelEn:
          'Main topics or themes discussed (e.g. leadership challenges, communication skills)',
        labelFr:
          'Principaux sujets ou thèmes abordés (p. ex. enjeux de leadership, communication)',
        type: 'long_text',
        required: true,
      },
      {
        id: 'issues_raised',
        labelEn: 'Personal or professional issues raised (if any)',
        labelFr: 'Questions personnelles ou professionnelles soulevées (le cas échéant)',
        type: 'long_text',
        required: false,
      },
      {
        id: 'key_insights',
        labelEn: 'Key insights or takeaways from this session',
        labelFr: 'Principaux enseignements tirés de cette séance',
        type: 'long_text',
        required: true,
      },
      {
        id: 'goal_progress',
        labelEn: 'Progress on previously set goals or actions',
        labelFr: 'Progrès sur les objectifs ou actions définis précédemment',
        type: 'single_select',
        required: true,
        options: [
          { value: 'significant', labelEn: 'Significant', labelFr: 'Important' },
          { value: 'moderate', labelEn: 'Moderate', labelFr: 'Modéré' },
          { value: 'limited', labelEn: 'Limited', labelFr: 'Limité' },
          { value: 'none', labelEn: 'No progress', labelFr: 'Aucun progrès' },
        ],
      },
      {
        id: 'progress_comment',
        labelEn: 'Comment on that progress',
        labelFr: 'Commentaire sur ces progrès',
        type: 'long_text',
        required: false,
      },
      {
        id: 'action_1',
        labelEn: 'New goal or action agreed — 1',
        labelFr: 'Nouvel objectif ou action convenu — 1',
        type: 'short_text',
        required: true,
      },
      {
        id: 'action_2',
        labelEn: 'New goal or action agreed — 2',
        labelFr: 'Nouvel objectif ou action convenu — 2',
        type: 'short_text',
        required: false,
      },
      {
        id: 'action_3',
        labelEn: 'New goal or action agreed — 3',
        labelFr: 'Nouvel objectif ou action convenu — 3',
        type: 'short_text',
        required: false,
      },
      {
        id: 'resources_required',
        labelEn: 'Resources or support required (if any)',
        labelFr: 'Ressources ou soutien nécessaires (le cas échéant)',
        type: 'long_text',
        required: false,
      },
      {
        id: 'additional_comments',
        labelEn:
          'Additional comments — notes, observations, or requests for programme support',
        labelFr:
          'Commentaires supplémentaires — notes, observations ou demandes de soutien au programme',
        type: 'long_text',
        required: false,
      },
      {
        id: 'terms_agreed',
        labelEn: 'I agree with the Terms of Use and Privacy Policy',
        labelFr: "J'accepte les conditions d'utilisation et la politique de confidentialité",
        type: 'boolean',
        required: true,
      },
  ],
};

/** Every standard set, in the order an admin sees them. */
export const STANDARD_FORMS: StandardForm[] = [
  QUARTERLY_MENTEE,
  QUARTERLY_MENTOR,
  MONTHLY_MENTEE,
];

/**
 * Validate a standard set against the live form contract.
 *
 * Called by the unit tests so a typo in a question set is caught at build time
 * rather than by an admin discovering the installer fails.
 */
export function validateStandardForm(form: StandardForm): { ok: true } | { ok: false; error: string } {
  const result = formSchemaShape.safeParse({ fields: form.fields });
  return result.success ? { ok: true } : { ok: false, error: result.error.message };
}
