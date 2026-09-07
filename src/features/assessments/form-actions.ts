'use server';

import type { ActionResult } from '@/lib/actions/result';
import {
  generateAssessmentWindows,
  setAssessmentWindowActive,
  updateAssessmentWindow,
} from './actions';

// useActionState wrappers for the admin assessment screens (same convention as
// features/forms/form-actions.ts): the underlying actions stay directly
// callable and typed, these adapt them to the (prevState, formData) signature.

export type GenerateWindowsFormState = ActionResult<{ created: number }> | null;
export type WindowFormState = ActionResult<{ id: string }> | null;

export async function generateAssessmentWindowsForm(
  _prev: GenerateWindowsFormState,
  formData: FormData,
): Promise<GenerateWindowsFormState> {
  return generateAssessmentWindows(formData);
}

export async function updateAssessmentWindowForm(
  _prev: WindowFormState,
  formData: FormData,
): Promise<WindowFormState> {
  return updateAssessmentWindow(formData);
}

export async function setAssessmentWindowActiveForm(
  _prev: WindowFormState,
  formData: FormData,
): Promise<WindowFormState> {
  return setAssessmentWindowActive(formData);
}
