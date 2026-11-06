import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { useFontStyle, useThemeColors } from '@/preferences/PreferencesProvider';
import { icons } from '@/theme/icons';

/** Native bottom bar: UITabBar on iOS and Material navigation bar on Android. */
export default function TabsLayout() {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { fontFamily } = useFontStyle('500');

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      tintColor={colors.accent}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.textSecondary, fontFamily },
        selected: { color: colors.text, fontFamily },
      }}
      indicatorColor={colors.tabIndicator}
      rippleColor={colors.tabIndicator}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.home')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icons.home.sf} md={icons.home.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="adoption">
        <NativeTabs.Trigger.Label>{t('tabs.adoption')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icons.adoption.sf} md={icons.adoption.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="post">
        <NativeTabs.Trigger.Label>{t('tabs.post')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icons.post.sf} md={icons.post.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="rescue">
        <NativeTabs.Trigger.Label>{t('tabs.rescue')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icons.rescue.sf} md={icons.rescue.md} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabs.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={icons.profile.sf} md={icons.profile.md} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
