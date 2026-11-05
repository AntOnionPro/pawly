import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { Button } from '@/components/Button';
import { Group } from '@/components/Group';
import { Loading, LoadError } from '@/components/QueryState';
import { SwitchRow } from '@/components/SwitchRow';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';
import { notify } from '@/utils/notify';

import { PUSH_TYPES, type PushType } from './api';
import { useEnablePush, usePushPermission, usePushPrefs, useSavePushPrefs } from './hooks';

/** Whether this phone shows push, and how to turn it on. */
function PermissionNote() {
  const { t } = useTranslation();
  const { data: permission } = usePushPermission();
  const enable = useEnablePush();

  if (permission === 'unavailable') {
    return (
      <ThemedText color="textSecondary">
        {Platform.OS === 'web' ? t('pushSettings.web') : t('pushSettings.unavailable')}
      </ThemedText>
    );
  }
  if (permission === 'denied') {
    return (
      <View style={styles.note}>
        <ThemedText color="textSecondary">{t('pushSettings.denied')}</ThemedText>
        <Button
          variant="secondary"
          label={t('pushSettings.openSettings')}
          onPress={() => void Linking.openSettings()}
        />
      </View>
    );
  }
  if (permission === 'undetermined') {
    return (
      <View style={styles.note}>
        <ThemedText color="textSecondary">{t('pushSettings.undetermined')}</ThemedText>
        <Button
          variant="secondary"
          icon="notifications"
          label={t('pushSettings.enable')}
          onPress={() => void enable()}
        />
      </View>
    );
  }
  return null;
}

/** Settings → Notifications: which push notifications to receive. */
export function NotificationSettings() {
  const { t } = useTranslation();
  const { data: saved, error, isPending, refetch } = usePushPrefs();
  const save = useSavePushPrefs();

  function toggle(type: PushType, value: boolean) {
    if (!saved) return;
    save.mutate(
      { ...saved, prefs: { ...saved.prefs, [type]: value } },
      {
        onError: (saveError) => {
          const key = requestErrorKey(requestErrorKind(saveError)) ?? 'errors.generic';
          notify(`${t('pushSettings.failed')} ${t(key)}`);
        },
      },
    );
  }

  return (
    <View style={styles.view}>
      <PermissionNote />
      {isPending ? (
        <Loading />
      ) : error ? (
        <LoadError error={error} onRetry={() => void refetch()} />
      ) : saved ? (
        <Group title={t('pushSettings.group')}>
          {PUSH_TYPES.map((type, index) => (
            <SwitchRow
              key={type}
              label={t(`pushSettings.types.${type}`)}
              value={saved.prefs[type]}
              onValueChange={(value) => toggle(type, value)}
              divider={index > 0}
            />
          ))}
        </Group>
      ) : null}
      <ThemedText variant="caption" color="textSecondary">
        {t('pushSettings.inApp')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: spacing.lg },
  note: { gap: spacing.sm },
});
