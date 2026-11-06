import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { UserRow } from '@/features/users/UserRow';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import type { FollowList } from './api';
import { useFollowList } from './hooks';

/** The followers of a user, or the users they follow. Loads more at the end. */
export function FollowListView({ userId, list }: { userId: string; list: FollowList }) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFollowList(userId, list);
  const users = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        // iOS 26+ draws the screen under the see-through header: start the list below it.
        contentInsetAdjustmentBehavior="automatic"
        data={users}
        keyExtractor={(user) => user.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => (
          <UserRow
            user={item}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : (
            <ThemedText color="textSecondary" style={styles.empty}>
              {list === 'followers' ? t('follows.noFollowers') : t('follows.noFollowing')}
            </ThemedText>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : undefined
        }
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  empty: { textAlign: 'center', padding: spacing.lg },
});
