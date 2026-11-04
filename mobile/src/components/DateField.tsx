import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { parseIsoDate, toIsoDate } from '@/auth/validation';
import { useColorSchemeName, useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { FieldError } from './FieldError';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

export interface DateFieldProps {
  label: string;
  /** "YYYY-MM-DD", or empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
  error?: string | null;
  maximumDate?: Date;
}

/** Where the picker opens when there is no value. No date is suggested as the answer. */
const PICKER_START = new Date(2000, 0, 1);

/** Native date picker: a dialog on Android and a spinner on iOS. Web: DateField.web.tsx. */
export function DateField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  maximumDate = new Date(),
}: DateFieldProps) {
  const colors = useThemeColors();
  const scheme = useColorSchemeName();
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const formatted = selected
    ? selected.toLocaleDateString(i18n.language, { dateStyle: 'long' })
    : placeholder;

  function show() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selected ?? PICKER_START,
        mode: 'date',
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toIsoDate(date));
        },
      });
    } else {
      setOpen((current) => !current);
    }
  }

  return (
    <View style={styles.container}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatted}`}
        accessibilityHint={hint}
        onPress={show}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.accent : colors.border,
            borderWidth: error ? 2 : StyleSheet.hairlineWidth * 2,
          },
          pressed && styles.pressed,
        ]}>
        <ThemedText color={selected ? 'text' : 'textSecondary'} style={styles.value}>
          {formatted}
        </ThemedText>
        <Icon name="calendar" size={20} color={colors.text} />
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={selected ?? PICKER_START}
          mode="date"
          display="spinner"
          maximumDate={maximumDate}
          locale={i18n.language}
          themeVariant={scheme}
          textColor={colors.text}
          onChange={(_event, date) => {
            if (date) onChange(toIsoDate(date));
          }}
        />
      ) : null}
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
  field: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: { flex: 1 },
  pressed: { opacity: 0.6 },
});
