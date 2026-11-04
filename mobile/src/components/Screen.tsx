import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

interface ScreenProps extends PropsWithChildren {
  /** Safe area edges to pad. Screens under a native header only need the bottom. */
  edges?: Edge[];
}

/** Scrollable screen with the theme background and safe area padding. */
export function Screen({ children, edges = ['top'] }: ScreenProps) {
  const colors = useThemeColors();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.md, gap: spacing.md },
});
