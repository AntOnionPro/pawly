import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import type { FollowList } from './api';
import { useFollowList } from './hooks';

function UserRow({ user, onPress }: { user: User; onPress: () => void }) {
  const { client } = useAuth();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`@${user.username}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar uri={avatarUrl(client, user, '100x100')} username={user.username} size={44} />
      <View style={styles.names}>
        <ThemedText style={styles.username} numberOfLines={1}>
          @{user.username}
        </ThemedText>
        {user.bio ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            {user.bio}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

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
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  names: { flex: 1 },
  username: { fontWeight: '600' },
  empty: { textAlign: 'center', padding: spacing.lg },
  pressed: { opacity: 0.6 },
});
