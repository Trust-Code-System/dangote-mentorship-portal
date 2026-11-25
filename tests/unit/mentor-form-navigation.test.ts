import { expect, it, vi } from 'vitest';
import { RoleName } from '@prisma/client';
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
import { buildParticipantNavSections } from '@/lib/nav/sections';

it('shows both recurring forms in the mentor menu', async () => {
  const sections = await buildParticipantNavSections([RoleName.MENTOR], 0, 0, true);
  const paths = sections.flatMap((s) => s.items.map((item) => item.href));
  expect(paths).toContain('/monthly-form');
  expect(paths).toContain('/assessment');
});

it('keeps the mentor monthly form when a stream opts out of quarterly assessments', async () => {
  const sections = await buildParticipantNavSections([RoleName.MENTOR], 0, 0, false);
  const paths = sections.flatMap((s) => s.items.map((item) => item.href));
  expect(paths).toContain('/monthly-form');
  expect(paths).not.toContain('/assessment');
});
