import { useTranslation } from 'react-i18next';

import { Group } from '@/components/Group';
import { NavRow } from '@/components/NavRow';
import { OptionGroup, type Option } from '@/components/OptionGroup';
import type { LanguagePreference } from '@/i18n';
import { usePreferences } from '@/preferences/PreferencesProvider';
import type { ThemePreference } from '@/preferences/storage';

interface SettingsContentProps {
  onOpenLegal?: (doc: 'terms' | 'privacy') => void;
}

/** Theme, language and legal documents. Rendered by the `/settings` route. */
export function SettingsContent({ onOpenLegal }: SettingsContentProps) {
  const { t } = useTranslation();
  const { theme, language, setTheme, setLanguage } = usePreferences();

  const themeOptions: Option<ThemePreference>[] = [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];

  // Language names stay in their own language so people can always find theirs.
  const languageOptions: Option<LanguagePreference>[] = [
    { value: 'system', label: t('settings.language.system') },
    { value: 'es', label: t('settings.language.es') },
    { value: 'en', label: t('settings.language.en') },
  ];

  return (
    <>
      <OptionGroup
        title={t('settings.theme.title')}
        options={themeOptions}
        selected={theme}
        onSelect={setTheme}
      />
      <OptionGroup
        title={t('settings.language.title')}
        options={languageOptions}
        selected={language}
        onSelect={setLanguage}
      />
      {onOpenLegal ? (
        <Group title={t('settings.legal')}>
          <NavRow
            icon="document"
            label={t('legal.terms.title')}
            onPress={() => onOpenLegal('terms')}
          />
          <NavRow
            icon="document"
            label={t('legal.privacy.title')}
            onPress={() => onOpenLegal('privacy')}
            divider
          />
        </Group>
      ) : null}
    </>
  );
}
