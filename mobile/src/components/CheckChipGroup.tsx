import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import type { Chip } from './ChipGroup';
import { FieldError } from './FieldError';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

interface CheckChipGroupProps<T extends string> {
  label: string;
  chips: readonly Chip<T>[];
  selected: readonly T[];
  /** The new choice, in the order of `chips`. */
  onChange: (values: T[]) => void;
  error?: string | null;
}

/** Chips to choose several at once (or none). The chosen ones are outlined with the accent. */
export function CheckChipGroup<T extends string>({
  label,
  chips,
  selected,
  onChange,
  error,
}: CheckChipGroupProps<T>) {
  const colors = useThemeColors();

  function toggle(value: T) {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(chips.map((chip) => chip.value).filter((item) => next.includes(item)));
  }

  return (
    <View style={styles.container}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <View accessibilityLabel={label} style={styles.row}>
        {chips.map((chip) => {
          const isSelected = selected.includes(chip.value);
          return (
            <Pressable
              key={chip.value}
              accessibilityRole="checkbox"
              accessibilityLabel={chip.label}
              accessibilityState={{ checked: isSelected }}
              onPress={() => toggle(chip.value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.tabIndicator : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                  borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth * 2,
                },
                pressed && styles.pressed,
              ]}>
              {isSelected ? <Icon name="check" size={16} color={colors.text} /> : null}
              <ThemedText style={isSelected ? styles.selectedText : undefined}>
                {chip.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectedText: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
