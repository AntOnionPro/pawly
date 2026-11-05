import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

export type FeedTab = 'following' | 'discover';

const TABS: readonly FeedTab[] = ['following', 'discover'];

/** "Following" and "Discover" tabs at the top of the home feed. */
export function FeedTabs({
  selected,
  onSelect,
}: {
  selected: FeedTab;
  onSelect: (tab: FeedTab) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <View accessibilityRole="tablist" style={[styles.row, { borderBottomColor: colors.border }]}>
      {TABS.map((tab) => {
        const isSelected = tab === selected;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(tab)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
            <ThemedText
              color={isSelected ? 'text' : 'textSecondary'}
              style={isSelected ? styles.selected : undefined}>
              {t(`feed.tabs.${tab}`)}
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
