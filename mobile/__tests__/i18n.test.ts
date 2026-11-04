import { createI18n, resolveLanguage } from '@/i18n';
import en from '@/i18n/locales/en';
import es from '@/i18n/locales/es';

describe('resolveLanguage', () => {
  it.each([
    ['es', 'es'],
    ['en', 'en'],
    ['es-MX', 'es'],
    ['EN_us', 'en'],
    ['fr', 'en'],
    ['pt', 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ] as const)('follows the phone language "%s" → %s', (device, expected) => {
    expect(resolveLanguage('system', device)).toBe(expected);
  });

  it('uses the language the user chose over the phone language', () => {
    expect(resolveLanguage('en', 'es')).toBe('en');
    expect(resolveLanguage('es', 'en')).toBe('es');
    expect(resolveLanguage('es', 'fr')).toBe('es');
  });
});

function leafKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? leafKeys(child as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('translations', () => {
  it('Spanish and English have the same keys', () => {
    expect(leafKeys(es).sort()).toEqual(leafKeys(en).sort());
  });

  it('no translation is empty', () => {
    for (const resources of [es, en]) {
      for (const key of leafKeys(resources)) {
        const value = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], resources);
        expect(typeof value === 'string' && value.trim().length > 0).toBe(true);
      }
    }
  });

  it('translates and interpolates in both languages', () => {
    expect(createI18n('es').t('comingSoon.stage', { stage: 2 })).toBe(
      'Esta sección llega en la etapa 2.',
    );
    expect(createI18n('en').t('comingSoon.stage', { stage: 2 })).toBe(
      'This section arrives in stage 2.',
    );
  });
});
