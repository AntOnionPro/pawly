import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { Wordmark } from '@/components/Wordmark';
import { MessagesButton } from '@/features/messages/MessagesButton';
import { isHiddenPost, useBlockedIds } from '@/features/moderation/hooks';
import { NotificationsButton } from '@/features/notifications/NotificationsButton';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import type { Post, PostFilter } from './api';
import { FeedTabs, type FeedTab } from './FeedTabs';
import { usePostList } from './hooks';
import { hasVideo, PostListItem } from './PostListItem';

const DISCOVER = { all: true } as const;

/** A post counts as in view when most of it is on screen. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

/** What FlatList tells about each post in view. */
interface ViewablePost {
  item: Post;
  isViewable: boolean;
}

/** The post whose video plays: the first one in view that has a video. */
export function postToPlay(viewable: ViewablePost[]): string | null {
  return viewable.find((token) => token.isViewable && hasVideo(token.item))?.item.id ?? null;
}

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
  // Only one video plays at a time: the one of the first post in view with a video.
  const [playingId, setPlayingId] = useState<string | null>(null);
  // FlatList does not allow changing this callback, so it is created once.
  const [onViewableItemsChanged] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewablePost[] }) =>
        setPlayingId(postToPlay(viewableItems)),
  );
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
        viewabilityConfig={VIEWABILITY}
        onViewableItemsChanged={onViewableItemsChanged}
        extraData={playingId}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.header}>
              <View style={styles.title}>
                <Wordmark />
              </View>
              <IconButton
                icon="search"
                size={26}
                label={t('search.title')}
                onPress={() => router.push('/search')}
              />
              {signedIn ? <NotificationsButton /> : null}
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
        renderItem={({ item }) => <PostListItem post={item} autoPlay={item.id === playingId} />}
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
