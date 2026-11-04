import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface OptionGroupProps<T extends string> {
  title: string;
  options: readonly Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

/** Grouped list of mutually exclusive options, like the system settings screens. */
export function OptionGroup<T extends string>({
  title,
  options,
  selected,
  onSelect,
}: OptionGroupProps<T>) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <ThemedText variant="label" color="textSecondary" style={styles.title}>
        {title}
      </ThemedText>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {options.map((option, index) => {
          const isSelected = option.value === selected;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onSelect(option.value)}
              android_ripple={{ color: colors.tabIndicator }}
              style={({ pressed }) => [
                styles.row,
                index > 0 && {
                  borderTopColor: colors.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.label}>{option.label}</ThemedText>
              {isSelected ? <Icon name="check" size={20} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { paddingHorizontal: spacing.md },
  group: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
