import { useRouter } from 'expo-router';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ComposerBar } from '@/components/ComposerBar';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { COMMENT_TEXT_MAX } from './api';
import { commentErrorKey, useAddComment } from './hooks';

interface CommentComposerProps {
  postId: string;
  /** Lets the screen focus the field (for example from the comment button). */
  inputRef?: Ref<TextInputInstance>;
  /** Called once the comment is saved (for example to scroll to it). */
  onSent?: () => void;
}

/** Bar under the comments to write a new one. Visitors get a button to sign in instead. */
export function CommentComposer({ postId, inputRef, onSent }: CommentComposerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();
  const colors = useThemeColors();
  const add = useAddComment(postId);
  const [text, setText] = useState('');

  async function send() {
    if (!text.trim() || add.isPending) return;
    try {
      await add.mutateAsync(text);
      setText('');
      onSent?.();
    } catch {
      // The error is shown above the field.
    }
  }

  if (status !== 'signedIn') {
    return (
      <View style={[styles.visitor, { borderTopColor: colors.border }]}>
        <Button
          variant="secondary"
          label={t('comments.signIn')}
          onPress={() => router.push('/sign-in')}
        />
      </View>
    );
  }
  return (
    <ComposerBar
      value={text}
      onChangeText={(value) => {
        setText(value);
        if (add.error) add.reset();
      }}
      onSend={() => void send()}
      sending={add.isPending}
      label={t('comments.label')}
      placeholder={t('comments.placeholder')}
      sendLabel={t('comments.send')}
      maxLength={COMMENT_TEXT_MAX}
      error={add.error ? t(commentErrorKey(add.error)) : null}
      inputRef={inputRef}
    />
  );
}

const styles = StyleSheet.create({
  visitor: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
