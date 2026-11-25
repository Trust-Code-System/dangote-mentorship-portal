'use client';
import { useActionState } from 'react';
import { submitGoalForm } from '@/features/goals/actions';
import { Button } from '@/components/ui/button';

export function SubmitGoal({ goalId, label }: { goalId: string; label: string }) {
  const [state, action, pending] = useActionState(submitGoalForm, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="goalId" value={goalId} />
      <Button type="submit" disabled={pending}>
        {pending ? 'Submitting…' : label}
      </Button>
      {state && !state.ok ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
