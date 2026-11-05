import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { spacing } from '@/theme/typography';

import { Icon } from './Icon';
import { ThemedText } from './ThemedText';

interface BadgeButtonProps {
  icon: IconName;
  label: string;
  /** Number shown on the icon; nothing when 0. */
  count: number;
  /** Read after the label by screen readers (for example "2 unread"). */
  countHint?: string;
  onPress: () => void;
}

/** Top bar icon with a small count (unread messages, notifications…). */
export function BadgeButton({ icon, label, count, countHint, onPress }: BadgeButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={count > 0 ? countHint : undefined}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name={icon} size={26} color={colors.text} />
      {count > 0 ? (
        // Text color on background color: readable at this small size in both themes.
        <View style={[styles.badge, { backgroundColor: colors.text }]}>
          <ThemedText style={[styles.count, { color: colors.background }]}>
            {count > 9 ? '9+' : count}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: spacing.xs },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
