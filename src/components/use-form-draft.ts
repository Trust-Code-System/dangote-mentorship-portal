'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDraft, clearDraft } from '@/features/drafts/actions';

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Debounced autosave for any form (experience-layer.md §1.11: "never lose
 * work"). Pass the form's current serializable values; the hook persists them
 * server-side after the user pauses typing, and exposes a `clear()` to call on
 * successful submit. Closing the browser never destroys input.
 *
 * Designed to sit alongside react-hook-form: feed it `watch()` output. Loading
 * the saved draft on mount is the page's job (see drafts/data.ts getDraft) so
 * this hook stays purely about writing.
 */
export function useFormDraft(params: {
  formKey: string;
  values: Record<string, unknown>;
  cohortId?: string;
  enabled?: boolean;
  delayMs?: number;
}): { status: DraftStatus; clear: () => Promise<void> } {
  const { formKey, values, cohortId, enabled = true, delayMs = 1000 } = params;
  const [status, setStatus] = useState<DraftStatus>('idle');

  const serialized = JSON.stringify(values);

  // Skip the first run: the initial render reflects the loaded draft (or empty
  // form), which there is no point re-saving immediately.
  const primed = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!primed.current) {
      primed.current = true;
      return;
    }
    setStatus('saving');
    const handle = setTimeout(async () => {
      const res = await saveDraft({ formKey, data: values, cohortId });
      setStatus(res.ok ? 'saved' : 'error');
    }, delayMs);
    return () => clearTimeout(handle);
  }, [serialized, formKey, cohortId, enabled, delayMs, values]);

  const clear = useCallback(async () => {
    await clearDraft({ formKey });
    setStatus('idle');
  }, [formKey]);

  return { status, clear };
}
