import { useRouter } from 'expo-router';
import { useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing, typography } from '@/theme/typography';

import { COMMENT_TEXT_MAX } from './api';
import { commentErrorKey, useAddComment } from './hooks';

/** The counter appears when this few characters are left. */
const SHOW_COUNT_WHEN_LEFT = 50;

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
  const canSend = text.trim().length > 0 && !add.isPending;

  async function send() {
    if (!canSend) return;
    try {
      await add.mutateAsync(text);
      setText('');
      onSent?.();
    } catch {
      // The error is shown above the field.
    }
  }

  return (
    <View style={[styles.bar, { borderTopColor: colors.border }]}>
      {status !== 'signedIn' ? (
        <Button
          variant="secondary"
          label={t('comments.signIn')}
          onPress={() => router.push('/sign-in')}
        />
      ) : (
        <>
          <FieldError message={add.error ? t(commentErrorKey(add.error)) : null} />
          <View style={styles.row}>
            <TextInput
              ref={inputRef}
              accessibilityLabel={t('comments.label')}
              placeholder={t('comments.placeholder')}
              value={text}
              onChangeText={(value) => {
                setText(value);
                if (add.error) add.reset();
              }}
              multiline
              maxLength={COMMENT_TEXT_MAX}
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.accent}
              style={[
                styles.input,
                typography.body,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('comments.send')}
              accessibilityState={{ disabled: !canSend, busy: add.isPending }}
              disabled={!canSend}
              hitSlop={8}
              onPress={() => void send()}
              style={({ pressed }) => [styles.send, (pressed || !canSend) && styles.dimmed]}>
              {add.isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Icon name="send" size={26} color={colors.accent} />
              )}
            </Pressable>
          </View>
          {COMMENT_TEXT_MAX - text.length <= SHOW_COUNT_WHEN_LEFT ? (
            <ThemedText variant="caption" color="textSecondary" style={styles.count}>
              {t('posts.textCount', { used: text.length, max: COMMENT_TEXT_MAX })}
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  send: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.4 },
  count: { textAlign: 'right' },
});
