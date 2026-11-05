import { useRouter } from 'expo-router';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { use, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { ComposerBar } from '@/components/ComposerBar';
import { IconButton } from '@/components/IconButton';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useBlockAction, useBlockedIds, useReportAction } from '@/features/moderation/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';
import { parseServerDate } from '@/utils/time';

import { MESSAGE_TEXT_MAX, type Message } from './api';
import { messageErrorKey, useConversation, useMessages, useSendMessage } from './hooks';
import { SharedPost } from './SharedPost';

/** The other participant, with "Report" and "Block". */
function ChatHeader({ other }: { other: User }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client } = useAuth();
  const colors = useThemeColors();
  const report = useReportAction();
  const { block } = useBlockAction(other);
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`@${other.username}`}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: other.id } })}
        style={({ pressed }) => [styles.who, pressed && styles.pressed]}>
        <Avatar uri={avatarUrl(client, other, '100x100')} username={other.username} size={36} />
        <ThemedText style={styles.username} numberOfLines={1}>
          @{other.username}
        </ThemedText>
      </Pressable>
      <IconButton
        icon="flag"
        size={20}
        label={t('report.user')}
        onPress={() => report({ kind: 'user', id: other.id })}
      />
      <IconButton icon="block" size={20} label={t('blocks.block')} onPress={() => void block()} />
    </View>
  );
}

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const report = useReportAction();
  const sentAt = parseServerDate(message.created);
  const time = sentAt
    ? sentAt.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
    : '';

  async function askToReport() {
    const confirmed = await confirm({
      title: t('messages.reportConfirmTitle'),
      message: t('messages.reportConfirmMessage'),
      confirmLabel: t('report.message'),
      cancelLabel: t('common.cancel'),
    });
    if (confirmed) report({ kind: 'message', id: message.id });
  }

  return (
    <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.theirsRow]}>
      <Pressable
        accessibilityLabel={[message.hasPost ? t('messages.sharedPost') : '', message.text, time]
          .filter(Boolean)
          .join(', ')}
        accessibilityActions={mine ? undefined : [{ name: 'report', label: t('report.message') }]}
        onAccessibilityAction={() => void askToReport()}
        onLongPress={mine ? undefined : () => void askToReport()}
        style={[
          styles.bubble,
          mine
            ? { backgroundColor: colors.tabIndicator }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        ]}>
        {message.hasPost ? <SharedPost post={message.post} /> : null}
        {message.text ? <ThemedText>{message.text}</ThemedText> : null}
        <ThemedText variant="caption" color="textSecondary" style={styles.time}>
          {time}
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** Messages of a conversation (newest at the bottom), updated live, and the bar to write. */
export function ChatView({ conversationId }: { conversationId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();
  const headerHeight = use(HeaderHeightContext) ?? 0;
  const conversation = useConversation(conversationId);
  const messages = useMessages(conversationId);
  const send = useSendMessage(conversationId);
  const blocked = useBlockedIds();
  const [text, setText] = useState('');
  const other = conversation.data?.other;
  const items = messages.data?.pages.flatMap((page) => page.items) ?? [];
  const iBlocked = other ? blocked.has(other.id) : false;

  async function submit() {
    if (!text.trim() || send.isPending) return;
    try {
      await send.mutateAsync(text);
      setText('');
    } catch {
      // The error is shown above the field.
    }
  }

  const loadError = conversation.error ?? messages.error;
  return (
    <SafeAreaView edges={['bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        {other ? <ChatHeader other={other} /> : null}
        {conversation.isPending || messages.isPending ? (
          <View style={styles.root}>
            <Loading />
          </View>
        ) : loadError ? (
          <View style={styles.root}>
            <LoadError
              error={loadError}
              onRetry={() => {
                void conversation.refetch();
                void messages.refetch();
              }}
            />
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.root, styles.center]}>
            <ThemedText color="textSecondary" style={styles.centerText}>
              {other ? t('messages.start', { username: other.username }) : ''}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            inverted
            style={styles.root}
            data={items}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => <Bubble message={item} mine={item.senderId === user?.id} />}
            contentContainerStyle={styles.list}
            onEndReachedThreshold={0.3}
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage) {
                void messages.fetchNextPage();
              }
            }}
            ListFooterComponent={
              messages.isFetchingNextPage ? <ActivityIndicator color={colors.accent} /> : undefined
            }
          />
        )}
        {other && iBlocked ? (
          <BlockedNotice other={other} />
        ) : (
          <ComposerBar
            value={text}
            onChangeText={(value) => {
              setText(value);
              if (send.error) send.reset();
            }}
            onSend={() => void submit()}
            sending={send.isPending}
            label={t('messages.label')}
            placeholder={t('messages.placeholder')}
            sendLabel={t('messages.send')}
            maxLength={MESSAGE_TEXT_MAX}
            error={send.error ? t(messageErrorKey(send.error)) : null}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BlockedNotice({ other }: { other: User }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { unblock, busy } = useBlockAction(other);
  return (
    <View style={[styles.blocked, { borderTopColor: colors.border }]}>
      <ThemedText color="textSecondary" style={styles.centerText}>
        {t('messages.blocked', { username: other.username })}
      </ThemedText>
      <Button variant="secondary" label={t('blocks.unblock')} loading={busy} onPress={unblock} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  username: { flex: 1, fontWeight: '600' },
  list: { padding: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row' },
  mineRow: { justifyContent: 'flex-end' },
  theirsRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.md * 1.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  time: { alignSelf: 'flex-end', fontSize: 11, lineHeight: 14 },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  centerText: { textAlign: 'center' },
  blocked: {
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
});
