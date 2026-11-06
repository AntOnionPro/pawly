import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { IconButton } from '@/components/IconButton';
import { ThemedText } from '@/components/ThemedText';
import { useFontStyle, useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing, typography } from '@/theme/typography';
import { confirm } from '@/utils/confirm';
import { notify } from '@/utils/notify';
import { useRelativeDate } from '@/utils/useRelativeDate';

import { COMMENT_TEXT_MAX, type Comment } from './api';
import { commentErrorKey, useDeleteComment, useUpdateComment } from './hooks';

interface CommentItemProps {
  comment: Comment;
  /** The author of the comment edits and deletes it. */
  isMine: boolean;
  /** The author of the post can delete any comment on it. */
  isPostAuthor: boolean;
  onPressAuthor?: (authorId: string) => void;
  /** Reports the comment (for comments by someone else). */
  onReport?: () => void;
}

/** A comment with its author and date. Its author can edit it in place. */
export function CommentItem({
  comment,
  isMine,
  isPostAuthor,
  onPressAuthor,
  onReport,
}: CommentItemProps) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const fontStyle = useFontStyle();
  const date = useRelativeDate(comment.created);
  const update = useUpdateComment(comment.postId);
  const remove = useDeleteComment(comment.postId);
  const [draft, setDraft] = useState<string | null>(null);
  const author = comment.author;
  const editing = draft !== null;

  async function save() {
    if (draft === null || !draft.trim()) return;
    try {
      await update.mutateAsync({ id: comment.id, text: draft });
      setDraft(null);
    } catch {
      // The error is shown under the field.
    }
  }

  async function deleteComment() {
    const confirmed = await confirm({
      title: t('comments.deleteConfirmTitle'),
      message: t('comments.deleteConfirmMessage'),
      confirmLabel: t('comments.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    remove.mutate(comment.id, {
      onError: (error) => notify(`${t('comments.deleteFailed')} ${t(commentErrorKey(error))}`),
    });
  }

  return (
    <View style={[styles.row, remove.isPending && styles.deleting]}>
      <Pressable
        accessible={false}
        disabled={!onPressAuthor || !author}
        onPress={() => author && onPressAuthor?.(author.id)}
        style={({ pressed }) => pressed && styles.pressed}>
        {author ? (
          <Avatar uri={avatarUrl(client, author, '100x100')} username={author.username} size={32} />
        ) : null}
      </Pressable>
      <View style={styles.body}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole={onPressAuthor && author ? 'link' : undefined}
            disabled={!onPressAuthor || !author}
            onPress={() => author && onPressAuthor?.(author.id)}
            style={({ pressed }) => [styles.meta, pressed && styles.pressed]}>
            <ThemedText numberOfLines={1}>
              <ThemedText style={styles.username}>{author ? `@${author.username}` : ''}</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                {`  ${date}`}
                {comment.edited ? ` · ${t('comments.edited')}` : ''}
              </ThemedText>
            </ThemedText>
          </Pressable>
          {isMine && !editing ? (
            <IconButton
              icon="edit"
              size={18}
              label={t('comments.edit')}
              onPress={() => {
                update.reset();
                setDraft(comment.text);
              }}
            />
          ) : null}
          {(isMine || isPostAuthor) && !editing ? (
            <IconButton
              icon="delete"
              size={18}
              label={t('comments.delete')}
              onPress={() => void deleteComment()}
            />
          ) : null}
          {onReport && !isMine ? (
            <IconButton icon="flag" size={18} label={t('report.comment')} onPress={onReport} />
          ) : null}
        </View>
        {editing ? (
          <View style={styles.editor}>
            <TextInput
              accessibilityLabel={t('comments.edit')}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              multiline
              maxLength={COMMENT_TEXT_MAX}
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.accent}
              style={[
                styles.input,
                typography.body,
                fontStyle,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
            <FieldError message={update.error ? t(commentErrorKey(update.error)) : null} />
            <View style={styles.editActions}>
              <Button variant="link" label={t('common.cancel')} onPress={() => setDraft(null)} />
              <Button
                variant="link"
                label={t('comments.save')}
                disabled={!draft.trim()}
                loading={update.isPending}
                onPress={() => void save()}
              />
            </View>
          </View>
        ) : (
          <ThemedText>{comment.text}</ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  body: { flex: 1, gap: spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 32 },
  meta: { flex: 1 },
  username: { fontWeight: '600' },
  editor: { gap: spacing.xs },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  pressed: { opacity: 0.6 },
  deleting: { opacity: 0.5 },
});
