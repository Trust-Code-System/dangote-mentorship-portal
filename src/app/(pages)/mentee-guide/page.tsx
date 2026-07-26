import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicGuidePage } from '@/components/public/public-guide-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.guides.mentee.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/mentee-guide' },
  };
}

export default function MenteeGuidePage() {
  return <PublicGuidePage kind="mentee" />;
}
