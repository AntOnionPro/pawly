import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

interface RepostButtonProps {
  count: number;
  reposted: boolean;
  onPress?: () => void;
}

/** Repost button with its count, in the accent color when the user reposted the post. */
export function RepostButton({ count, reposted, onPress }: RepostButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={reposted ? t('reposts.undo') : t('reposts.repost')}
      accessibilityHint={t('reposts.count', { count })}
      accessibilityState={{ selected: reposted, disabled: !onPress }}
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name="repost" size={24} color={reposted ? colors.accent : colors.text} />
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
