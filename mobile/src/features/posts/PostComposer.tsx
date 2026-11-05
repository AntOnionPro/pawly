import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { usePets } from '@/features/pets/hooks';
import { spacing } from '@/theme/typography';

import { POST_FILES_MAX, POST_TEXT_MAX, type Post } from './api';
import { useCreatePost } from './hooks';
import { pickPostMedia, type ComposerMedia } from './media';
import { MediaStrip } from './MediaStrip';
import { PetPicker } from './PetPicker';

interface PostComposerProps {
  /** A pet to tag from the start (for example, from an adoption follow-up reminder). */
  petId?: string;
  onPublished: (post: Post) => void;
}

/** New post: photos and videos, text and tagged pets. */
export function PostComposer({ petId, onPublished }: PostComposerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: pets = [] } = usePets(user?.id);
  const create = useCreatePost();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [petIds, setPetIds] = useState<string[]>(petId ? [petId] : []);
  const [errors, setErrors] = useState<string[]>([]);

  const remaining = POST_FILES_MAX - media.length;
  const isEmpty = !text.trim() && media.length === 0;

  async function addMedia() {
    const picked = await pickPostMedia(remaining);
    setMedia((current) => [...current, ...picked.media].slice(0, POST_FILES_MAX));
    setErrors(picked.errors.map((key) => t(key)));
  }

  async function publish() {
    setErrors([]);
    if (isEmpty) {
      setErrors([t('errors.postEmpty')]);
      return;
    }
    try {
      const post = await create.mutateAsync({ text, media, petIds });
      setText('');
      setMedia([]);
      setPetIds([]);
      onPublished(post);
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
      <ThemedText variant="title" accessibilityRole="header">
        {t('post.title')}
      </ThemedText>
      <MediaStrip
        media={media}
        onRemove={(index) => setMedia((current) => current.filter((_, i) => i !== index))}
      />
      {remaining > 0 ? (
        <Button
          variant="secondary"
          icon="gallery"
          label={t('posts.addMedia')}
          accessibilityHint={t('posts.mediaHint', { count: remaining })}
          onPress={addMedia}
        />
      ) : null}
      <ThemedText variant="caption" color="textSecondary">
        {t('posts.limits')}
      </ThemedText>
      <TextField
        label={t('posts.text')}
        hint={t('posts.textCount', { used: text.length, max: POST_TEXT_MAX })}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={POST_TEXT_MAX}
      />
      <PetPicker pets={pets} selected={petIds} onChange={setPetIds} />
      {errors.map((message) => (
        <FieldError key={message} message={message} />
      ))}
      <Button
        label={create.isPending ? t('posts.publishing') : t('posts.publish')}
        onPress={publish}
        loading={create.isPending}
        disabled={isEmpty}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
