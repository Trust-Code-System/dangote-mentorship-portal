import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GoalForm } from '@/app/(dashboard)/goals/goal-form';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  clear: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/features/goals/actions', () => ({
  saveGoalForm: mocks.save,
  requestGoalCoach: vi.fn(),
}));
vi.mock('@/components/use-form-draft', () => ({
  useFormDraft: () => ({ status: 'idle', clear: mocks.clear }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.clear.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue({ ok: true, data: { id: 'saved-goal' } });
});
afterEach(cleanup);
async function completeStepsAndSave() {
  fireEvent.change(screen.getByLabelText('titleField'), {
    target: { value: 'Develop leadership skills' },
  });
  for (let step = 0; step < 4; step++)
    fireEvent.click(screen.getByRole('button', { name: /Next step/ }));
  fireEvent.click(screen.getByRole('button', { name: 'saveAndContinue' }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
}
describe('first goal save and continue', () => {
  it('takes the mentee to the dashboard only after the server confirms the goal was saved', async () => {
    render(<GoalForm mode="create" onboarding enableDraft cohortId="cohort-1" />);
    expect(mocks.router.replace).not.toHaveBeenCalled();
    await completeStepsAndSave();
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.router.refresh).toHaveBeenCalledOnce();
  });
  it('stays on setup and preserves the draft when saving fails', async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      error: { code: 'VALIDATION', message: 'Invalid goal' },
    });
    render(<GoalForm mode="create" onboarding enableDraft cohortId="cohort-1" />);
    await completeStepsAndSave();
    await waitFor(() => expect(screen.getByText('errorBody')).toBeVisible());
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
});
