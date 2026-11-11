import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { isHelpSlug } from '@/features/help/articles';
import { Card, CardContent } from '@/components/ui/card';

// A single Help Center article (experience-layer.md §1.11). Body is an array of
// paragraphs in the i18n catalogue, rendered as plain text — short and scannable.
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isHelpSlug(slug)) notFound();

  const t = await getTranslations('help');
  const body = t.raw(`articles.${slug}.body`);
  const paragraphs: string[] = Array.isArray(body) ? body : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/help" className="text-sm text-muted-foreground hover:underline">
          ← {t('back')}
        </Link>
        <h1 className="mt-1 font-display text-h1 font-semibold tracking-tight text-ink">{t(`articles.${slug}.title`)}</h1>
        <p className="text-muted-foreground">{t(`articles.${slug}.summary`)}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6 text-sm leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
