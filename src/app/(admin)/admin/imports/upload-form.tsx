'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { confirmImportUpload, prepareImportUpload, uploadImport } from '@/features/imports/actions';
import type { ActionResult } from '@/lib/actions/result';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadFileToSignedTarget } from '@/lib/storage/browser-upload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type UploadState = ActionResult<{ id: string }> | null;

type CohortOption = { id: string; name: string };

export function UploadForm({ cohorts }: { cohorts: CohortOption[] }) {
  const t = useTranslations('imports');
  const router = useRouter();
  const [state, setState] = useState<UploadState>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get('file');
    const cohortId = String(formData.get('cohortId') ?? '');
    const targetRole = String(formData.get('targetRole') ?? '') as 'MENTOR' | 'MENTEE';
    if (!(file instanceof File) || file.size === 0) return;
    setPending(true);
    setState(null);
    try {
      const prepared = await prepareImportUpload({ cohortId, targetRole, name: file.name, size: file.size });
      if (!prepared.ok) return setState(prepared);
      if (prepared.data.mode === 'server') {
        const result = await uploadImport(formData);
        if (result?.ok) router.push(`/admin/imports/${result.data.id}`);
        else if (result) setState(result);
      } else {
        await uploadFileToSignedTarget({ ...prepared.data, file });
        const result = await confirmImportUpload({
          cohortId,
          targetRole,
          path: prepared.data.path,
          name: file.name,
          size: file.size,
        });
        if (result.ok) router.push(`/admin/imports/${result.data.id}`);
        else setState(result);
      }
    } catch (error) {
      setState({ ok: false, error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : t('uploadFailed') } });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold">{t('upload')}</h2>
      <p className="text-sm text-muted-foreground">{t('uploadHint')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cohortId">{t('cohort')}</Label>
          <Select name="cohortId" required defaultValue={cohorts[0]?.id}>
            <SelectTrigger id="cohortId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetRole">{t('targetRole')}</Label>
          <Select name="targetRole" required defaultValue="MENTOR">
            <SelectTrigger id="targetRole">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MENTOR">{t('mentors')}</SelectItem>
              <SelectItem value="MENTEE">{t('mentees')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">{t('file')}</Label>
        <Input id="file" name="file" type="file" accept=".csv,.xlsx,.xls,.xlsm" required />
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {t('submit')}
      </Button>
    </form>
  );
}
