import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

interface PawButtonProps {
  count: number;
  pawed: boolean;
  onPress?: () => void;
}

/** The paw print reaction: filled with the accent color when given, with its count. */
export function PawButton({ count, pawed, onPress }: PawButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pawed ? t('posts.paw.remove') : t('posts.paw.add')}
      accessibilityHint={t('posts.paw.count', { count })}
      accessibilityState={{ selected: pawed, disabled: !onPress }}
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name="paw" selected={pawed} size={26} color={pawed ? colors.accent : colors.text} />
      <ThemedText style={styles.count}>{count}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingRight: spacing.sm,
  },
  count: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
