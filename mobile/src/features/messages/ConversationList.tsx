import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useBlockedIds } from '@/features/moderation/hooks';
import { useAskForPushOnce } from '@/features/push/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { Conversation } from './api';
import { useConversations } from './hooks';

function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client, user } = useAuth();
  const colors = useThemeColors();
  const date = useRelativeDate(conversation.lastMessageAt);
  const other = conversation.other;
  const mine = conversation.lastSenderId === user?.id;
  // A message that only shares a post has no text.
  const text = conversation.lastMessageText || t('messages.sharedPost');
  const preview = mine ? t('messages.you', { text }) : text;
  const label = [
    other ? `@${other.username}` : '',
    conversation.unread ? t('messages.unreadMark') : '',
    preview,
    date,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {other ? (
        <Avatar uri={avatarUrl(client, other, '100x100')} username={other.username} size={48} />
      ) : null}
      <View style={styles.text}>
        <View style={styles.top}>
          <ThemedText style={styles.username} numberOfLines={1}>
            {other ? `@${other.username}` : ''}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {date}
          </ThemedText>
        </View>
        <ThemedText
          variant="caption"
          color={conversation.unread ? 'text' : 'textSecondary'}
          style={conversation.unread ? styles.unreadText : undefined}
          numberOfLines={1}>
          {preview}
        </ThemedText>
      </View>
      {conversation.unread ? (
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
      ) : null}
    </Pressable>
  );
}

/** The user's conversations, the most recent first. */
export function ConversationList() {
  // A good moment to ask for the notification permission (only the first time).
  useAskForPushOnce();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const blocked = useBlockedIds();
  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversations();
  const conversations = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (conversation) => !blocked.has(conversation.otherId),
  );

  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={conversations}
        keyExtractor={(conversation) => conversation.id}
        renderItem={({ item }) => <ConversationRow conversation={item} />}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : (
            <ThemedText color="textSecondary" style={styles.empty}>
              {t('messages.empty')}
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
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  text: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  username: { flex: 1, fontWeight: '600' },
  unreadText: { fontWeight: '700' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { textAlign: 'center', padding: spacing.lg },
  pressed: { opacity: 0.6 },
});
