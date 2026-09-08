import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicGuidePage } from '@/components/public/public-guide-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.guides.programme.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/programme' },
  };
}

export default function ProgrammeGuidePage() {
  return <PublicGuidePage kind="programme" />;
}
