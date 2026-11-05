import { useRouter } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useAdoptionPhoto } from '@/features/adoption/AdoptionCard';
import type { Adoption } from '@/features/adoption/api';
import { useBlockedIds } from '@/features/moderation/hooks';
import { useAskForPushOnce } from '@/features/push/hooks';
import { mediaKind, mediaUrl } from '@/features/posts/api';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { AppNotification } from './api';
import { useMarkAllNotificationsRead, useNotifications } from './hooks';

const COMMENT_PREVIEW = 80;

/** "@sol left a paw print on your post", etc. */
function useNotificationText(notification: AppNotification): string {
  const { t } = useTranslation();
  const username = notification.actor?.username ?? '';
  const pet = notification.adoption?.pet?.name ?? '';
  switch (notification.type) {
    case 'paw':
      return t('notifications.paw', { username });
    case 'comment':
      return t('notifications.comment', {
        username,
        text: notification.commentText.slice(0, COMMENT_PREVIEW),
      });
    case 'follow':
      return t('notifications.follow', { username });
    case 'repost':
      return t('notifications.repost', { username });
    case 'adoption_request':
      return t('notifications.adoptionRequest', { username, pet });
    case 'request_accepted':
      return t('notifications.requestAccepted', { username, pet });
    case 'request_rejected':
      return t('notifications.requestRejected', { username, pet });
    case 'adopted':
      return t('notifications.adopted', { pet });
    case 'followup_due':
      return t('notifications.followupDue', {
        username,
        pet,
        when: notification.followupMilestone
          ? t(`adoption.followups.milestones.${notification.followupMilestone}`)
          : '',
      });
    case 'followup_posted':
      return t('notifications.followupPosted', { username, pet });
  }
}

/** Small picture of the listing an adoption notification is about. */
function AdoptionThumb({ adoption }: { adoption: Adoption }) {
  const photo = useAdoptionPhoto(adoption);
  return photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null;
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client } = useAuth();
  const colors = useThemeColors();
  const text = useNotificationText(notification);
  const date = useRelativeDate(notification.created);
  const actor = notification.actor;
  const post = notification.post;
  const photo = post?.media.find((file) => mediaKind(file) === 'photo');

  function open() {
    if (notification.type === 'followup_due' && notification.adoption?.petId) {
      // Straight to a new post with the pet tagged.
      router.push({ pathname: '/post', params: { petId: notification.adoption.petId } });
    } else if (notification.type === 'followup_posted' && notification.postId) {
      router.push({ pathname: '/post/[id]', params: { id: notification.postId } });
    } else if (notification.type === 'adopted' && notification.adoption?.petId) {
      router.push({ pathname: '/pet/[id]', params: { id: notification.adoption.petId } });
    } else if (notification.type === 'adoption_request' && notification.adoptionId) {
      router.push({
        pathname: '/adoption/[id]/requests',
        params: { id: notification.adoptionId },
      });
    } else if (notification.adoptionId) {
      router.push({ pathname: '/adoption/[id]', params: { id: notification.adoptionId } });
    } else if (notification.type === 'follow') {
      router.push({ pathname: '/user/[id]', params: { id: notification.actorId } });
    } else if (notification.postId) {
      router.push({ pathname: '/post/[id]', params: { id: notification.postId } });
    }
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[notification.read ? '' : t('notifications.new'), text, date]
        .filter(Boolean)
        .join(', ')}
      onPress={open}
      style={({ pressed }) => [
        styles.row,
        !notification.read && { backgroundColor: colors.tabIndicator },
        pressed && styles.pressed,
      ]}>
      {actor ? (
        <Avatar uri={avatarUrl(client, actor, '100x100')} username={actor.username} size={44} />
      ) : null}
      <View style={styles.text}>
        <ThemedText>{text}</ThemedText>
        <ThemedText variant="caption" color="textSecondary">
          {date}
        </ThemedText>
      </View>
      {post && photo ? (
        <Image source={{ uri: mediaUrl(client, post, photo, '300x300') }} style={styles.photo} />
      ) : null}
      {notification.adoption && !(post && photo) ? (
        <AdoptionThumb adoption={notification.adoption} />
      ) : null}
    </Pressable>
  );
}

/** The user's notifications, newest first. Opening it marks them as read. */
export function NotificationList() {
  // A good moment to ask for the notification permission (only the first time).
  useAskForPushOnce();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const blocked = useBlockedIds();
  const markAllRead = useMarkAllNotificationsRead();
  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotifications();
  const notifications = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (notification) => !blocked.has(notification.actorId),
  );
  // Marks as read whenever a new unread notification shows up (also one that arrives live).
  const newestUnread = notifications.find((notification) => !notification.read)?.id;
  const markRead = useEffectEvent(() => {
    markAllRead.mutate();
  });
  useEffect(() => {
    if (newestUnread) markRead();
  }, [newestUnread]);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={notifications}
        keyExtractor={(notification) => notification.id}
        renderItem={({ item }) => <NotificationRow notification={item} />}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : (
            <ThemedText color="textSecondary" style={styles.empty}>
              {t('notifications.empty')}
            </ThemedText>
          )
        }
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
  content: { padding: spacing.sm, gap: spacing.xs, flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    minHeight: 56,
  },
  text: { flex: 1, gap: 2 },
  photo: { width: 48, height: 48, borderRadius: radius.md / 2 },
  empty: { textAlign: 'center', padding: spacing.lg },
  pressed: { opacity: 0.6 },
});
