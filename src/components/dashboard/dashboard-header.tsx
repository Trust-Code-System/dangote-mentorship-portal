import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CalendarDays, ArrowUpRight } from 'lucide-react';
import type { RoleName } from '@prisma/client';
import { Button } from '@/components/ui/button';

export async function DashboardHeader({
  titleKey,
  userName,
}: {
  titleKey: 'mentor' | 'mentee' | 'reviewer' | 'trainer';
  userName?: string | null;
  roles: RoleName[];
}) {
  const t = await getTranslations('dashboard');
  const w = await getTranslations('workspace');
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="space-y-2">
        <p className="text-ink-3 text-xs font-medium">{t(titleKey)}</p>
        <h1 className="text-h1 text-ink font-semibold tracking-tight">
          {userName ? w('greeting', { name: userName.split(' ')[0] ?? userName }) : t(titleKey)}
        </h1>
        <p className="text-small text-ink-2 max-w-xl leading-relaxed">
          {w(titleKey === 'mentee' ? 'menteeSubtitle' : 'mentorSubtitle')}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/calendar">
          <CalendarDays className="size-4" />
          {w('viewCalendar')}
          <ArrowUpRight className="size-3" />
        </Link>
      </Button>
    </header>
  );
}
