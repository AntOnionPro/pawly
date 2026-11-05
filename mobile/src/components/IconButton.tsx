import { Pressable, StyleSheet } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { spacing } from '@/theme/typography';

import { Icon } from './Icon';

interface IconButtonProps {
  icon: IconName;
  /** Read by screen readers: icon buttons have no visible text. */
  label: string;
  onPress: () => void;
  size?: number;
}

/** A button that is only an icon (edit, delete…). */
export function IconButton({ icon, label, onPress, size = 22 }: IconButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name={icon} size={size} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: spacing.xs },
  pressed: { opacity: 0.6 },
});
