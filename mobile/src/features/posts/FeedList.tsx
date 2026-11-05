import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import type { Post } from './api';
import { usePostList } from './hooks';
import { PostCard } from './PostCard';

const FEED = { all: true } as const;

/** Home feed: every post, newest first. Loads more at the end; pull down to refresh. */
export function FeedList() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePostList(FEED);
  const posts: Post[] = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        testID="feed"
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Icon name="paw" selected size={28} color={colors.accent} />
            <ThemedText variant="title" accessibilityRole="header">
              {t('home.title')}
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : (
            <ThemedText color="textSecondary" style={styles.center}>
              {t('feed.empty')}
            </ThemedText>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : posts.length > 0 && !hasNextPage ? (
            <ThemedText
              variant="caption"
              color="textSecondary"
              style={[styles.center, styles.footer]}>
              {t('feed.end')}
            </ThemedText>
          ) : undefined
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onOpen={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
            onPressAuthor={(id) => router.push({ pathname: '/user/[id]', params: { id } })}
            onPressPet={(id) => router.push({ pathname: '/pet/[id]', params: { id } })}
          />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => void refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: spacing.lg },
  center: { textAlign: 'center', padding: spacing.lg },
  footer: { marginVertical: spacing.lg },
});
