import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { MessagesButton } from '@/features/messages/MessagesButton';
import { isHiddenPost, useBlockedIds } from '@/features/moderation/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import type { Post, PostFilter } from './api';
import { FeedTabs, type FeedTab } from './FeedTabs';
import { usePostList } from './hooks';
import { PostListItem } from './PostListItem';

const DISCOVER = { all: true } as const;

/**
 * Home feed, newest first: "Following" (posts by the people you follow) and "Discover" (every
 * post). Visitors only see Discover. Loads more at the end; pull down to refresh.
 */
export function FeedList() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { status, user } = useAuth();
  const [tab, setTab] = useState<FeedTab>('following');
  const signedIn = status === 'signedIn' && user !== null;
  const showFollowing = signedIn && tab === 'following';
  const filter: PostFilter = showFollowing && user ? { followedBy: user.id } : DISCOVER;
  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePostList(filter);
  const blocked = useBlockedIds();
  // Posts by blocked users (or reposting them) are hidden.
  const posts: Post[] = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (post) => !isHiddenPost(post, blocked),
  );

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
          <View style={styles.top}>
            <View style={styles.header}>
              <Icon name="paw" selected size={28} color={colors.accent} />
              <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
                {t('home.title')}
              </ThemedText>
              <IconButton
                icon="search"
                size={26}
                label={t('search.title')}
                onPress={() => router.push('/search')}
              />
              {signedIn ? <MessagesButton /> : null}
            </View>
            {signedIn ? <FeedTabs selected={tab} onSelect={setTab} /> : null}
          </View>
        }
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : showFollowing ? (
            <View style={styles.followingEmpty}>
              <ThemedText color="textSecondary" style={styles.centerText}>
                {t('feed.followingEmpty')}
              </ThemedText>
              <Button
                variant="secondary"
                label={t('feed.goDiscover')}
                onPress={() => setTab('discover')}
              />
            </View>
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
        renderItem={({ item }) => <PostListItem post={item} />}
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
  top: { gap: spacing.sm, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginVertical: spacing.lg },
  center: { textAlign: 'center', padding: spacing.lg },
  centerText: { textAlign: 'center' },
  followingEmpty: { gap: spacing.md, padding: spacing.lg },
  footer: { marginVertical: spacing.lg },
});
