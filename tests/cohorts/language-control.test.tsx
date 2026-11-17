import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CohortLanguageControl } from '@/app/(admin)/admin/cohorts/cohort-language-control';
import { CohortLocaleGuard } from '@/components/cohort-locale-guard';

const localeState = vi.hoisted(() => ({ active: 'en' }));
const setLocaleMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('next-intl', () => ({
  useLocale: () => localeState.active,
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/i18n/actions', () => ({
  setLocale: setLocaleMock,
}));

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

async function render(node: React.ReactNode) {
  await act(async () => {
    root.render(node);
  });
}

describe('cohort language controls', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localeState.active = 'en';
    setLocaleMock.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('always submits English and leaves French out when the admin turns it off', async () => {
    await render(
      <form>
        <CohortLanguageControl defaultFrenchEnabled={false} />
      </form>,
    );

    const form = container.querySelector('form')!;
    const french = container.querySelector<HTMLInputElement>('[value="FR"]')!;
    expect(french.checked).toBe(false);
    expect(new FormData(form).getAll('languages')).toEqual(['EN']);
  });

  it('submits French again when the admin turns it on', async () => {
    await render(
      <form>
        <CohortLanguageControl defaultFrenchEnabled={false} />
      </form>,
    );

    const form = container.querySelector('form')!;
    const french = container.querySelector<HTMLInputElement>('[value="FR"]')!;
    await act(async () => french.click());

    expect(french.checked).toBe(true);
    expect(new FormData(form).getAll('languages')).toEqual(['EN', 'FR']);
  });

  it('renders no language controls for an English-only participant', async () => {
    await render(<CohortLocaleGuard availableLocales={['en']} />);
    expect(container.childElementCount).toBe(0);
    expect(setLocaleMock).not.toHaveBeenCalled();
  });

  it('renders no language controls for bilingual participants and programme admins', async () => {
    localeState.active = 'fr';
    await render(<CohortLocaleGuard availableLocales={['en', 'fr']} />);
    expect(container.childElementCount).toBe(0);
    expect(setLocaleMock).not.toHaveBeenCalled();
  });

  it('moves a participant off French when their cohort no longer offers it', async () => {
    localeState.active = 'fr';
    await render(<CohortLocaleGuard availableLocales={['en']} />);

    expect(setLocaleMock).toHaveBeenCalledWith('en');
    expect(container.childElementCount).toBe(0);
  });
});
