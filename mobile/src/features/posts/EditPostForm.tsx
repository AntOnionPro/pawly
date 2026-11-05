import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { usePets } from '@/features/pets/hooks';
import { spacing } from '@/theme/typography';

import { POST_TEXT_MAX, type Post } from './api';
import { useUpdatePost } from './hooks';
import { MediaCarousel } from './MediaCarousel';
import { PetPicker } from './PetPicker';

/** Edits the text and the tagged pets of a post. Photos and videos stay as they are. */
export function EditPostForm({ post, onSaved }: { post: Post; onSaved: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: pets = [] } = usePets(user?.id);
  const update = useUpdatePost();
  const [text, setText] = useState(post.text);
  const [petIds, setPetIds] = useState(post.petIds);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!text.trim() && post.media.length === 0) {
      setError(t('errors.postEmpty'));
      return;
    }
    try {
      await update.mutateAsync({ id: post.id, changes: { text, petIds } });
      onSaved();
    } catch (err) {
      const [fieldError] = Object.values(toFieldErrors(err));
      const key = fieldError ?? requestErrorKey(requestErrorKind(err));
      setError(key ? t(key) : null);
    }
  }

  return (
    <View style={styles.container}>
      <MediaCarousel post={post} />
      <TextField
        label={t('posts.text')}
        hint={t('posts.textCount', { used: text.length, max: POST_TEXT_MAX })}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={POST_TEXT_MAX}
      />
      <PetPicker pets={pets} selected={petIds} onChange={setPetIds} />
      <FieldError message={error} />
      <Button label={t('posts.save')} onPress={save} loading={update.isPending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
});
