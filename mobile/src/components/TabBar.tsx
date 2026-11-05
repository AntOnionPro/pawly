import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { ThemedText } from './ThemedText';

export interface Tab<T extends string> {
  value: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: readonly Tab<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

/** Row of tabs at the top of a list; the selected one is underlined with the accent. */
export function TabBar<T extends string>({ tabs, selected, onSelect }: TabBarProps<T>) {
  const colors = useThemeColors();
  return (
    <View accessibilityRole="tablist" style={[styles.row, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => {
        const isSelected = tab.value === selected;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(tab.value)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
            <ThemedText
              color={isSelected ? 'text' : 'textSecondary'}
              style={isSelected ? styles.selected : undefined}>
              {tab.label}
            </ThemedText>
            <View style={[styles.indicator, isSelected && { backgroundColor: colors.accent }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm, gap: spacing.sm, minHeight: 44 },
  selected: { fontWeight: '700' },
  indicator: { height: 3, alignSelf: 'stretch', borderRadius: 2 },
  pressed: { opacity: 0.6 },
});
