import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicGuidePage } from '@/components/public/public-guide-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('publicPages.guides.mentor.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/mentor-guide' },
  };
}

export default function MentorGuidePage() {
  return <PublicGuidePage kind="mentor" />;
}
