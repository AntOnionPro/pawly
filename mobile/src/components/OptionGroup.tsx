import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** A color shown before the label (for example, a palette). */
  swatch?: string;
}

interface OptionGroupProps<T extends string> {
  title: string;
  options: readonly Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
  /** A short explanation below the options. */
  footer?: string;
}

/** Grouped list of mutually exclusive options, like the system settings screens. */
export function OptionGroup<T extends string>({
  title,
  options,
  selected,
  onSelect,
  footer,
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
              {option.swatch ? (
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: option.swatch, borderColor: colors.border },
                  ]}
                />
              ) : null}
              <ThemedText style={styles.label}>{option.label}</ThemedText>
              {isSelected ? <Icon name="check" size={20} color={colors.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
      {footer ? (
        <ThemedText variant="caption" color="textSecondary" style={styles.title}>
          {footer}
        </ThemedText>
      ) : null}
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
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.6 },
});
