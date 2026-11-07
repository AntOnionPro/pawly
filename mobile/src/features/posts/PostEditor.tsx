import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { ThemedText } from '@/components/ThemedText';
import { usePets } from '@/features/pets/hooks';
import { useFontStyle, useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing, typography } from '@/theme/typography';

import { mediaKind, mediaUrl, POST_FILES_MAX, POST_TEXT_MAX, type Post } from './api';
import { pickPostMedia, type ComposerMedia } from './media';
import { MediaStrip, type MediaTile } from './MediaStrip';
import { PetPicker } from './PetPicker';

/** The counter appears when the text gets this close to the limit. */
const COUNTER_FROM = POST_TEXT_MAX - 200;

export interface PostEditorValues {
  text: string;
  petIds: string[];
  /** New photos and videos, in order. */
  add: ComposerMedia[];
  /** Saved files the person removed (when editing). */
  remove: string[];
}

interface PostEditorProps {
  /** The post being edited; without it, a new post. */
  post?: Post;
  /** A pet to tag from the start (for example, from an adoption follow-up reminder). */
  petId?: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** Saves; when it throws, what was written and chosen stays and the error is shown. */
  onSubmit: (values: PostEditorValues) => Promise<void>;
}

/**
 * Writing a post, in the order it is read: who posts (and the button to publish, at the top),
 * the text, the photos and videos (with "+" to add more) and the tagged pets. The same screen
 * edits a post, including its photos and videos.
 */
export function PostEditor({
  post,
  petId,
  submitLabel,
  pendingLabel,
  pending,
  onSubmit,
}: PostEditorProps) {
  const { t } = useTranslation();
  const { client, user } = useAuth();
  const colors = useThemeColors();
  const fontStyle = useFontStyle();
  const { data: pets = [] } = usePets(user?.id);
  const [text, setText] = useState(post?.text ?? '');
  const [petIds, setPetIds] = useState<string[]>(post?.petIds ?? (petId ? [petId] : []));
  const [kept, setKept] = useState<string[]>(post?.media ?? []);
  const [added, setAdded] = useState<ComposerMedia[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const remaining = POST_FILES_MAX - kept.length - added.length;
  const isEmpty = !text.trim() && kept.length + added.length === 0;
  const tiles: MediaTile[] = [
    ...kept.map((name) => ({
      uri: post ? mediaUrl(client, post, name, '300x300') : '',
      kind: mediaKind(name),
    })),
    ...added,
  ];

  function remove(index: number) {
    if (index < kept.length) {
      setKept((current) => current.filter((_, i) => i !== index));
    } else {
      setAdded((current) => current.filter((_, i) => i !== index - kept.length));
    }
  }

  async function addMedia() {
    const picked = await pickPostMedia(remaining);
    setAdded((current) => [...current, ...picked.media].slice(0, POST_FILES_MAX - kept.length));
    setErrors(picked.errors.map((key) => t(key)));
  }

  async function submit() {
    setErrors([]);
    if (isEmpty) {
      setErrors([t('errors.postEmpty')]);
      return;
    }
    try {
      await onSubmit({
        text,
        petIds,
        add: added,
        remove: (post?.media ?? []).filter((name) => !kept.includes(name)),
      });
    } catch (error) {
      const fieldErrors = Object.values(toFieldErrors(error)).flatMap((key) =>
        key ? [t(key)] : [],
      );
      const general = requestErrorKey(requestErrorKind(error));
      setErrors(fieldErrors.length > 0 ? fieldErrors : general ? [t(general)] : []);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        {user ? (
          <Avatar uri={avatarUrl(client, user, '100x100')} username={user.username} size={40} />
        ) : null}
        <ThemedText style={styles.username} numberOfLines={1}>
          {user ? `@${user.username}` : ''}
        </ThemedText>
        <Button
          size="compact"
          label={pending ? pendingLabel : submitLabel}
          onPress={() => void submit()}
          loading={pending}
          disabled={isEmpty}
        />
      </View>
      <TextInput
        accessibilityLabel={t('posts.text')}
        placeholder={t('posts.placeholder')}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={POST_TEXT_MAX}
        style={[styles.text, typography.body, styles.textSize, fontStyle, { color: colors.text }]}
      />
      {text.length >= COUNTER_FROM ? (
        <ThemedText variant="caption" color="textSecondary" style={styles.counter}>
          {t('posts.textCount', { used: text.length, max: POST_TEXT_MAX })}
        </ThemedText>
      ) : null}
      <MediaStrip
        media={tiles}
        onRemove={remove}
        onAdd={remaining > 0 ? () => void addMedia() : undefined}
        addHint={t('posts.mediaHint', { count: remaining })}
      />
      <ThemedText variant="caption" color="textSecondary">
        {t('posts.limits')}
      </ThemedText>
      <PetPicker pets={pets} selected={petIds} onChange={setPetIds} />
      {errors.map((message) => (
        <FieldError key={message} message={message} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  username: { flex: 1, fontWeight: '600' },
  // No box: the text reads like the post it will be.
  text: { minHeight: 120, textAlignVertical: 'top', padding: 0 },
  textSize: { fontSize: 18, lineHeight: 26 },
  counter: { alignSelf: 'flex-end' },
});
