'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  confirmGoalEvidenceUpload,
  prepareGoalEvidenceUpload,
  uploadGoalEvidence,
  type GoalActionState,
} from '@/features/goals/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadFileToSignedTarget } from '@/lib/storage/browser-upload';

// Upload evidence of goal progress (experience-layer.md §1.7). Files are stored
// via the storage seam and served only through the authorized download route.
export function EvidenceUpload({ goalId }: { goalId: string }) {
  const t = useTranslations('goals');
  const tc = useTranslations('common');
  const fileId = useId();
  const noteId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, setState] = useState<GoalActionState>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get('file');
    const note = String(formData.get('note') ?? '');
    if (!(file instanceof File) || file.size === 0) return;
    setPending(true);
    setState(null);
    try {
      const prepared = await prepareGoalEvidenceUpload({
        goalId,
        name: file.name,
        type: file.type,
        size: file.size,
        note,
      });
      if (!prepared.ok) return setState(prepared);
      let result: GoalActionState;
      if (prepared.data.mode === 'server') {
        result = await uploadGoalEvidence(formData);
      } else {
        const target = prepared.data;
        await uploadFileToSignedTarget({ ...target, file });
        result = await confirmGoalEvidenceUpload({
          goalId,
          path: target.path,
          name: file.name,
          type: file.type,
          size: file.size,
          note,
        });
      }
      setState(result);
      if (result?.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    } catch (error) {
      setState({ ok: false, error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Upload failed.' } });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={(event) => void submit(event)} className="space-y-2 border-t pt-3">
      <input type="hidden" name="goalId" value={goalId} />
      <div className="space-y-1">
        <Label htmlFor={fileId}>{t('evidenceFile')}</Label>
        <Input
          id={fileId}
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx,.txt"
        />
        <p className="text-xs text-muted-foreground">{t('evidenceHint')}</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={noteId}>{t('evidenceNote')}</Label>
        <Input id={noteId} name="note" maxLength={500} />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error.message || tc('errorBody')}</p>
      ) : null}

      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? tc('loading') : t('uploadEvidence')}
      </Button>
    </form>
  );
}
