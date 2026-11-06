import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useFontStyle, useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing, typography } from '@/theme/typography';

import { FieldError } from './FieldError';
import { ThemedText } from './ThemedText';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, ...input }: TextFieldProps) {
  const colors = useThemeColors();
  const fontStyle = useFontStyle();
  return (
    <View style={styles.container}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={[
          styles.input,
          typography.body,
          fontStyle,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.accent : colors.border,
            borderWidth: error ? 2 : StyleSheet.hairlineWidth * 2,
          },
        ]}
        {...input}
      />
      {hint && !error ? (
        <ThemedText variant="caption" color="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
