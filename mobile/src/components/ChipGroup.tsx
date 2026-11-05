import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { FieldError } from './FieldError';
import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

export interface Chip<T extends string> {
  value: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  label: string;
  chips: readonly Chip<T>[];
  selected: T | '';
  onSelect: (value: T) => void;
  error?: string | null;
}

/** Wrapping row of single-choice chips. The selected one is outlined with the accent. */
export function ChipGroup<T extends string>({
  label,
  chips,
  selected,
  onSelect,
  error,
}: ChipGroupProps<T>) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
        {chips.map((chip) => {
          const isSelected = chip.value === selected;
          return (
            <Pressable
              key={chip.value}
              accessibilityRole="radio"
              accessibilityLabel={chip.label}
              accessibilityState={{ checked: isSelected }}
              onPress={() => onSelect(chip.value)}
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
