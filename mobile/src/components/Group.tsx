import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { ThemedText } from './ThemedText';

/** Titled card that groups rows, like the system settings screens. */
export function Group({ title, children }: PropsWithChildren<{ title: string }>) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <ThemedText variant="label" color="textSecondary" style={styles.title}>
        {title}
      </ThemedText>
      <View
        accessibilityLabel={title}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  title: { paddingHorizontal: spacing.md },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
