import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind } from '@/api/errors';
import { Button } from '@/components/Button';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { UserRow } from '@/features/users/UserRow';
import { spacing } from '@/theme/typography';
import { notify } from '@/utils/notify';

import { useBlocks, useUnblockUser } from './hooks';

/** The users the signed-in user blocked, each with "Unblock". */
export function BlockedList() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: blocks, error, isPending, refetch } = useBlocks();
  const unblock = useUnblockUser();

  if (isPending) return <Loading />;
  if (error) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (blocks.length === 0) {
    return (
      <ThemedText color="textSecondary" style={styles.empty}>
        {t('blocks.empty')}
      </ThemedText>
    );
  }
  return (
    <View style={styles.list}>
      {blocks.map((block) =>
        block.blocked ? (
          <View key={block.id} style={styles.row}>
            <View style={styles.user}>
              <UserRow
                user={block.blocked}
                onPress={() =>
                  router.push({ pathname: '/user/[id]', params: { id: block.blockedId } })
                }
              />
            </View>
            <Button
              variant="secondary"
              label={t('blocks.unblock')}
              accessibilityHint={t('blocks.unblockUser', { username: block.blocked.username })}
              loading={unblock.isPending && unblock.variables === block.id}
              onPress={() =>
                unblock.mutate(block.id, {
                  onError: (unblockError) => {
                    const key = requestErrorKey(requestErrorKind(unblockError)) ?? 'errors.generic';
                    notify(`${t('blocks.failed')} ${t(key)}`);
                  },
                })
              }
            />
          </View>
        ) : null,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  user: { flex: 1 },
  empty: { textAlign: 'center', padding: spacing.lg },
});
