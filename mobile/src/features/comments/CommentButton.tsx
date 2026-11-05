import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

interface CommentButtonProps {
  count: number;
  /** Opens the comments. Without it the count is shown read-only. */
  onPress?: () => void;
}

/** Comment icon with the number of comments of a post. */
export function CommentButton({ count, onPress }: CommentButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('comments.open')}
      accessibilityHint={t('comments.count', { count })}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name="comment" size={24} color={colors.text} />
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
