import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors } from '@/api/errors';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { TextField } from '@/components/TextField';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { POST_TEXT_MAX, type Post } from './api';
import { PostCard } from './PostCard';
import { useAddRepost } from './reposts';

/** Optional comment and "Repost", with the original post below. */
export function RepostForm({ post, onDone }: { post: Post; onDone: () => void }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const add = useAddRepost();
  const [comment, setComment] = useState('');

  async function submit() {
    try {
      await add.mutateAsync({ postId: post.id, comment });
      onDone();
    } catch {
      // The error is shown above the button.
    }
  }

  const fieldErrors = toFieldErrors(add.error);
  const errorKey = add.error
    ? (fieldErrors.repostOf ??
      fieldErrors.text ??
      requestErrorKey(requestErrorKind(add.error)) ??
      'errors.generic')
    : null;

  return (
    <View style={styles.form}>
      <HeaderAction
        label={t('reposts.publish')}
        pendingLabel={t('reposts.publishing')}
        loading={add.isPending}
        onPress={() => void submit()}
      />
      <FieldError message={errorKey ? t(errorKey) : null} />
      <TextField
        label={t('reposts.comment')}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={POST_TEXT_MAX}
      />
      <View style={[styles.original, { borderColor: colors.border }]}>
        <PostCard post={post} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  original: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
});
