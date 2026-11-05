import type { Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing, typography } from '@/theme/typography';

import { FieldError } from './FieldError';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

/** The counter appears when this few characters are left. */
const SHOW_COUNT_WHEN_LEFT = 50;

interface ComposerBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  /** Field label for screen readers, and the hint shown inside it. */
  label: string;
  placeholder: string;
  sendLabel: string;
  maxLength: number;
  error?: string | null;
  inputRef?: Ref<TextInputInstance>;
}

/** Bar at the bottom of a screen to write and send a short text (comments, messages). */
export function ComposerBar({
  value,
  onChangeText,
  onSend,
  sending,
  label,
  placeholder,
  sendLabel,
  maxLength,
  error,
  inputRef,
}: ComposerBarProps) {
  const colors = useThemeColors();
  const canSend = value.trim().length > 0 && !sending;
  return (
    <View style={[styles.bar, { borderTopColor: colors.border }]}>
      <FieldError message={error} />
      <View style={styles.row}>
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={maxLength}
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
          accessibilityLabel={sendLabel}
          accessibilityState={{ disabled: !canSend, busy: sending }}
          disabled={!canSend}
          hitSlop={8}
          onPress={onSend}
          style={({ pressed }) => [styles.send, (pressed || !canSend) && styles.dimmed]}>
          {sending ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Icon name="send" size={26} color={colors.accent} />
          )}
        </Pressable>
      </View>
      {maxLength - value.length <= SHOW_COUNT_WHEN_LEFT ? (
        <ThemedText variant="caption" color="textSecondary" style={styles.count}>
          {`${value.length}/${maxLength}`}
        </ThemedText>
      ) : null}
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
