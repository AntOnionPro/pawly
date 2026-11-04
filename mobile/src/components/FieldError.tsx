import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

/** Error under a field or above a form. The palette has no red: an icon marks it instead. */
export function FieldError({ message }: { message?: string | null }) {
  const colors = useThemeColors();
  if (!message) return null;
  return (
    <View style={styles.row} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="error" size={18} color={colors.accent} />
      <ThemedText variant="caption" style={styles.text}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  text: { flex: 1, fontWeight: '600' },
});
