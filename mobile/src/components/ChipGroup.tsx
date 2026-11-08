import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
  /**
   * wrap: the chips wrap to new lines under the label (forms). row: one line that scrolls
   * sideways, with the label at its start (filters, to take little room).
   */
  layout?: 'wrap' | 'row';
}

/** Single-choice chips. The selected one is outlined with the accent. */
export function ChipGroup<T extends string>({
  label,
  chips,
  selected,
  onSelect,
  error,
  layout = 'wrap',
}: ChipGroupProps<T>) {
  const colors = useThemeColors();
  const items = chips.map((chip) => {
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
        <ThemedText style={isSelected ? styles.selectedText : undefined}>{chip.label}</ThemedText>
      </Pressable>
    );
  });

  if (layout === 'row') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        contentContainerStyle={styles.scroll}>
        <ThemedText variant="label" color="textSecondary">
          {label}
        </ThemedText>
        {items}
      </ScrollView>
    );
  }
  return (
    <View style={styles.container}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
        {items}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  scroll: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
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
