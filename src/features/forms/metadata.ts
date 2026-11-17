import type { FormField } from './schema';

/** Preserve source grouping and privacy when an administrator edits labels. */
export function formFieldMetadata(field: Partial<FormField>) {
  return {
    sectionEn: field.sectionEn,
    helpEn: field.helpEn,
    inputType: field.inputType,
    sourceQuestion: field.sourceQuestion,
    confidential: field.confidential,
    reporting: field.reporting,
    declaration: field.declaration,
    maxSelections: field.maxSelections,
  };
}

export function protectPrivateFields(fields: FormField[], previous: FormField[]): FormField[] {
  return fields.map((field) => {
    const old = previous.find((f) => f.id === field.id);
    return old?.confidential ? { ...field, confidential: true, reporting: false } : field;
  });
}
