import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Loading, LoadError } from '@/components/QueryState';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { useBlockedIds } from '@/features/moderation/hooks';
import { targetPost } from '@/features/posts/api';
import { usePost } from '@/features/posts/hooks';
import { useShareOutside } from '@/features/posts/reposts';
import { cleanQuery } from '@/features/search/api';
import { useUserSearch } from '@/features/search/hooks';
import { SearchField } from '@/features/search/SearchField';
import { spacing } from '@/theme/typography';
import { notify } from '@/utils/notify';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

import { MESSAGE_TEXT_MAX } from './api';
import { messageErrorKey, useConversations, useSharePost } from './hooks';

/** How long typing must pause before searching. */
const SEARCH_DELAY_MS = 350;

function Person({
  person,
  sent,
  sending,
  onSend,
}: {
  person: User;
  sent: boolean;
  sending: boolean;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const { client } = useAuth();
  return (
    <View style={styles.person}>
      <Avatar uri={avatarUrl(client, person, '100x100')} username={person.username} size={40} />
      <ThemedText style={styles.username} numberOfLines={1}>
        @{person.username}
      </ThemedText>
      <Button
        variant={sent ? 'secondary' : 'primary'}
        label={sent ? t('share.sent') : t('share.send')}
        accessibilityHint={t('share.sendTo', { username: person.username })}
        disabled={sent}
        loading={sending}
        onPress={onSend}
      />
    </View>
  );
}

/**
 * Share a post: outside Pawly (system share sheet) or by direct message to recent
 * conversations or anyone found by username, with an optional note.
 */
export function SharePostView({ postId }: { postId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const post = usePost(postId);
  const target = post.data ? targetPost(post.data) : undefined;
  const shareOutside = useShareOutside();
  const share = useSharePost();
  const blocked = useBlockedIds();
  const [note, setNote] = useState('');
  const [text, setText] = useState('');
  const [sentTo, setSentTo] = useState<string[]>([]);
  const query = cleanQuery(useDebouncedValue(text, SEARCH_DELAY_MS));
  const conversations = useConversations();
  const search = useUserSearch(query);

  const source = query ? search : conversations;
  const people = (
    query
      ? (search.data?.pages.flatMap((page) => page.items) ?? [])
      : (conversations.data?.pages.flatMap((page) => page.items) ?? [])
          .map((conversation) => conversation.other)
          .filter((other): other is User => other !== undefined)
  ).filter((person) => person.id !== user?.id && !blocked.has(person.id));

  function sendTo(person: User) {
    if (!target) return;
    share.mutate(
      { userId: person.id, postId: target.id, note },
      {
        onSuccess: () => setSentTo((current) => [...current, person.id]),
        onError: (error) => notify(`${t('share.sendFailed')} ${t(messageErrorKey(error))}`),
      },
    );
  }

  if (post.isPending) return <Loading />;
  if (post.error) return <LoadError error={post.error} onRetry={() => void post.refetch()} />;

  return (
    <View style={styles.view}>
      <Button
        variant="secondary"
        icon="share"
        label={t('share.outside')}
        onPress={() => target && shareOutside(target)}
      />
      <TextField
        label={t('share.note')}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={MESSAGE_TEXT_MAX}
      />
      <SearchField
        value={text}
        onChangeText={setText}
        label={t('share.searchPeople')}
        placeholder={t('share.searchPeople')}
        autoFocus={false}
      />
      <ThemedText variant="label" color="textSecondary">
        {query ? t('search.tabs.users') : t('share.recent')}
      </ThemedText>
      {source.isPending && (query || !conversations.data) ? (
        <Loading />
      ) : source.error ? (
        <LoadError error={source.error} onRetry={() => void source.refetch()} />
      ) : people.length === 0 ? (
        <ThemedText color="textSecondary">
          {query ? t('search.noResults', { query }) : t('share.noConversations')}
        </ThemedText>
      ) : (
        people.map((person) => (
          <Person
            key={person.id}
            person={person}
            sent={sentTo.includes(person.id)}
            sending={share.isPending && share.variables?.userId === person.id}
            onSend={() => sendTo(person)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  view: { gap: spacing.md },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  username: { flex: 1, fontWeight: '600' },
});
