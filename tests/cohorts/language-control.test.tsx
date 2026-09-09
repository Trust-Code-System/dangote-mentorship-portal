import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CohortLanguageControl } from '@/app/(admin)/admin/cohorts/cohort-language-control';
import { LocaleSwitcher } from '@/components/locale-switcher';

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

  it('hides the language switcher for an English-only participant', async () => {
    await render(<LocaleSwitcher availableLocales={['en']} />);
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('keeps both choices for bilingual participants and programme admins', async () => {
    await render(<LocaleSwitcher availableLocales={['en', 'fr']} />);
    expect(
      Array.from(container.querySelectorAll('button')).map((button) => button.textContent),
    ).toEqual(['en', 'fr']);
  });

  it('moves a participant off French when their cohort no longer offers it', async () => {
    localeState.active = 'fr';
    await render(<LocaleSwitcher availableLocales={['en']} />);

    expect(setLocaleMock).toHaveBeenCalledWith('en');
    expect(container.querySelector('button')?.textContent).toBe('en');
  });
});
