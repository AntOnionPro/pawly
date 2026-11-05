import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { User } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

import { useBlockAction, useReportAction } from './hooks';

/** "Block" and "Report" on someone's profile. */
export function ProfileModeration({ user }: { user: User }) {
  const { t } = useTranslation();
  const report = useReportAction();
  const { block, busy } = useBlockAction(user);
  return (
    <View style={styles.row}>
      <Button
        variant="link"
        icon="block"
        label={t('blocks.block')}
        loading={busy}
        onPress={() => void block()}
      />
      <Button
        variant="link"
        icon="flag"
        label={t('report.user')}
        onPress={() => report({ kind: 'user', id: user.id })}
      />
    </View>
  );
}

/** Shown instead of the content of a profile the user blocked. */
export function BlockedProfile({ user }: { user: User }) {
  const { t } = useTranslation();
  const { unblock, busy } = useBlockAction(user);
  return (
    <View style={styles.blocked}>
      <ThemedText color="textSecondary" style={styles.center}>
        {t('blocks.blocked', { username: user.username })}
      </ThemedText>
      <Button variant="secondary" label={t('blocks.unblock')} loading={busy} onPress={unblock} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  blocked: { gap: spacing.md, paddingVertical: spacing.md },
  center: { textAlign: 'center' },
});
