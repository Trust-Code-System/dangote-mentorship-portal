'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// First-login guided tour per role (experience-layer.md §1.11). A dismissible,
// step-by-step card shown once and never again unless re-requested (Help Center).
// Persisted in localStorage so there's no schema change; re-arming clears the key.
export const tourStorageKey = (role: string) => `mp-tour-${role}`;

interface TourStep {
  title: string;
  body: string;
}

export function OnboardingTour({ role }: { role: 'mentee' | 'mentor' }) {
  const t = useTranslations('tour');
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  const raw = t.raw(`${role}.steps`);
  const steps: TourStep[] = Array.isArray(raw) ? (raw as TourStep[]) : [];

  // Only decide visibility on the client (localStorage isn't available on the server).
  useEffect(() => {
    try {
      if (!localStorage.getItem(tourStorageKey(role))) {
        queueMicrotask(() => setVisible(true));
      }
    } catch {
      // Private mode / storage disabled — simply don't show the tour.
    }
  }, [role]);

  function dismiss() {
    try {
      localStorage.setItem(tourStorageKey(role), new Date().toISOString());
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible || steps.length === 0) return null;
  const step = steps[Math.min(index, steps.length - 1)]!;
  const isLast = index >= steps.length - 1;

  return (
    <Card className="border-primary">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {t('stepLabel', { current: index + 1, total: steps.length })}
          </p>
          <CardTitle className="text-base">{step.title}</CardTitle>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          {t('skip')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
          >
            {t('back')}
          </Button>
          {isLast ? (
            <Button type="button" size="sm" onClick={dismiss}>
              {t('done')}
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => setIndex((i) => i + 1)}>
              {t('next')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
