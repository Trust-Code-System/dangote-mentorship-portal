'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ActionItemStatus } from '@prisma/client';
import { updateActionItemStatus } from '@/features/sessions/actions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUSES = Object.values(ActionItemStatus);

// Status control for an action item (experience-layer.md §1.6). Editable by the
// assignee or the mentee recorder; changing the select submits immediately.
export function ActionItemStatusControl({
  itemId,
  status,
  canEdit,
}: {
  itemId: string;
  status: ActionItemStatus;
  canEdit: boolean;
}) {
  const t = useTranslations('sessions');
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!canEdit) {
    return <span className="text-xs text-muted-foreground">{t(`itemStatus.${status}`)}</span>;
  }

  function onChange(next: string) {
    start(async () => {
      const fd = new FormData();
      fd.set('itemId', itemId);
      fd.set('status', next);
      await updateActionItemStatus(fd);
      router.refresh();
    });
  }

  return (
    <Select value={status} disabled={pending} onValueChange={onChange}>
      <SelectTrigger aria-label={t('status')} className="h-8 w-auto text-small">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`itemStatus.${s}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
