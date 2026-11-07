import { useTranslation } from 'react-i18next';

import { Group } from '@/components/Group';
import { NavRow } from '@/components/NavRow';
import { OptionGroup, type Option } from '@/components/OptionGroup';
import type { LanguagePreference } from '@/i18n';
import { usePreferences } from '@/preferences/PreferencesProvider';
import {
  AUTOPLAY_PREFERENCES,
  NEARBY_RADII,
  type AutoplayPreference,
  type ThemePreference,
} from '@/preferences/storage';
import { LIGHT_PALETTES, PALETTE_NAMES, type PaletteName } from '@/theme/colors';
import type { FontPreference } from '@/theme/fonts';

export interface AccountActions {
  onNotifications: () => void;
  onBlockedUsers: () => void;
  onChangePassword: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

interface SettingsContentProps {
  /** Shown only with a session. */
  account?: AccountActions;
  onOpenLegal?: (doc: 'terms' | 'privacy') => void;
}

/** Account, theme, language and legal documents. Rendered by the `/settings` route. */
export function SettingsContent({ account, onOpenLegal }: SettingsContentProps) {
  const { t } = useTranslation();
  const {
    theme,
    language,
    nearbyRadiusKm,
    font,
    palette,
    autoplay,
    setTheme,
    setLanguage,
    setNearbyRadius,
    setFont,
    setPalette,
    setAutoplay,
  } = usePreferences();

  const themeOptions: Option<ThemePreference>[] = [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];

  const paletteOptions: Option<PaletteName>[] = PALETTE_NAMES.map((name) => ({
    value: name,
    label: t(`settings.palette.${name}`),
    swatch: LIGHT_PALETTES[name].accent,
  }));

  const fontOptions: Option<FontPreference>[] = [
    { value: 'ubuntu', label: t('settings.font.ubuntu') },
    { value: 'system', label: t('settings.font.system') },
  ];

  const autoplayOptions: Option<AutoplayPreference>[] = AUTOPLAY_PREFERENCES.map((value) => ({
    value,
    label: t(`settings.autoplay.${value}`),
  }));

  // Language names stay in their own language so people can always find theirs.
  const languageOptions: Option<LanguagePreference>[] = [
    { value: 'system', label: t('settings.language.system') },
    { value: 'es', label: t('settings.language.es') },
    { value: 'en', label: t('settings.language.en') },
  ];

  return (
    <>
      {account ? (
        <Group title={t('settings.account')}>
          <NavRow
            icon="notifications"
            label={t('pushSettings.title')}
            onPress={account.onNotifications}
          />
          <NavRow icon="block" label={t('blocks.title')} onPress={account.onBlockedUsers} divider />
          <NavRow
            icon="lock"
            label={t('account.password.title')}
            onPress={account.onChangePassword}
            divider
          />
          <NavRow
            icon="signOut"
            label={t('account.signOut.label')}
            onPress={account.onSignOut}
            divider
          />
          <NavRow
            icon="delete"
            label={t('account.delete.label')}
            onPress={account.onDeleteAccount}
            divider
          />
        </Group>
      ) : null}
      <OptionGroup
        title={t('settings.theme.title')}
        options={themeOptions}
        selected={theme}
        onSelect={setTheme}
      />
      <OptionGroup
        title={t('settings.palette.title')}
        options={paletteOptions}
        selected={palette}
        onSelect={setPalette}
        footer={t('settings.palette.hint')}
      />
      <OptionGroup
        title={t('settings.font.title')}
        options={fontOptions}
        selected={font}
        onSelect={setFont}
      />
      <OptionGroup
        title={t('settings.language.title')}
        options={languageOptions}
        selected={language}
        onSelect={setLanguage}
      />
      <OptionGroup
        title={t('settings.autoplay.title')}
        options={autoplayOptions}
        selected={autoplay}
        onSelect={setAutoplay}
        footer={t('settings.autoplay.hint')}
      />
      <OptionGroup
        title={t('settings.nearby')}
        options={NEARBY_RADII.map((radius) => ({
          value: String(radius),
          label: t('settings.nearbyRadius', { count: radius }),
        }))}
        selected={String(nearbyRadiusKm)}
        onSelect={(value) => {
          const radius = NEARBY_RADII.find((item) => String(item) === value);
          if (radius) setNearbyRadius(radius);
        }}
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
