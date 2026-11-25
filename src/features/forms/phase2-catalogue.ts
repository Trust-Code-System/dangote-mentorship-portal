import { ReviewType, RoleName } from '@prisma/client';
import sourceForms from './phase2-2026-2027.json' with { type: 'json' };
import { formSchemaShape } from './schema';
import { STANDARD_FORMS } from './catalogue';

export const PHASE2_FORMS = sourceForms.map((form) => ({
  ...form,
  type: form.type as ReviewType,
  roleName: form.roleName as RoleName,
  schema: formSchemaShape.parse(form.schema),
}));

/** The existing monthly mentee form is retained, rather than inventing a source. */
export function phase2MonthlyForm() {
  const monthly = STANDARD_FORMS.find(
    (f) => f.type === ReviewType.MONTHLY && f.roleName === RoleName.MENTEE,
  )!;
  return {
    type: monthly.type,
    roleName: monthly.roleName,
    title: 'Monthly review — mentee — 2026/2027',
    schema: formSchemaShape.parse({
      fields: monthly.fields.map((f) => ({
        ...f,
        labelFr: '',
        options: f.options?.map((o) => ({ ...o, labelFr: '' })),
      })),
    }),
  };
}
