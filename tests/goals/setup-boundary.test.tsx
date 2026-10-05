import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GoalSetupBoundary } from '@/features/goals/setup-boundary';

const navigation = vi.hoisted(() => ({ path: '/goals', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.path,
  useRouter: () => ({ replace: navigation.replace }),
}));
afterEach(() => {
  cleanup();
  navigation.replace.mockClear();
  navigation.path = '/goals';
});
describe('mandatory goal navigation', () => {
  it('renders the goal form', () => {
    render(
      <GoalSetupBoundary>
        <p>Set your goal</p>
      </GoalSetupBoundary>,
    );
    expect(screen.getByText('Set your goal')).toBeVisible();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it.each(['/dashboard', '/messages', '/profile', '/goals-other', '/goals/nested'])(
    'blocks navigation to %s while a shared layout is retained',
    (path) => {
      const view = render(
        <GoalSetupBoundary>
          <p>Set your goal</p>
        </GoalSetupBoundary>,
      );
      navigation.path = path;
      view.rerender(
        <GoalSetupBoundary>
          <p>Other feature content</p>
        </GoalSetupBoundary>,
      );
      expect(screen.queryByText('Other feature content')).not.toBeInTheDocument();
      expect(navigation.replace).toHaveBeenCalledWith('/goals');
    },
  );
});
