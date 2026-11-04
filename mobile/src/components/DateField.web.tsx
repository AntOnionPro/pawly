import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { toIsoDate } from '@/auth/validation';
import { useColorSchemeName, useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing, typography } from '@/theme/typography';

import type { DateFieldProps } from './DateField';
import { FieldError } from './FieldError';
import { ThemedText } from './ThemedText';

/** Web version: the browser's own date input. */
export function DateField({
  label,
  value,
  onChange,
  hint,
  error,
  maximumDate = new Date(),
}: DateFieldProps) {
  const colors = useThemeColors();
  const scheme = useColorSchemeName();
  return (
    <View style={styles.container}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      {createElement('input', {
        type: 'date',
        'aria-label': label,
        value,
        max: toIsoDate(maximumDate),
        onChange: (event: { target: { value: string } }) => onChange(event.target.value),
        style: {
          minHeight: 48,
          borderRadius: radius.md,
          padding: `0 ${spacing.md}px`,
          fontSize: typography.body.fontSize,
          fontFamily: 'inherit',
          color: colors.text,
          backgroundColor: colors.surface,
          border: `${error ? 2 : 1}px solid ${error ? colors.accent : colors.border}`,
          colorScheme: scheme,
        },
      })}
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
});
