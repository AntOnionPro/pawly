import { Pressable, StyleSheet } from 'react-native';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

interface UserLinkProps {
  user: User;
  /** A sentence about the user, such as "Published by @sol". */
  label: string;
  onPress: () => void;
}

/** Row with a user's photo and a sentence about them; opens their profile. */
export function UserLink({ user, label, onPress }: UserLinkProps) {
  const { client } = useAuth();
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar uri={avatarUrl(client, user, '100x100')} username={user.username} size={40} />
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Icon name="chevron" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  label: { flex: 1 },
  pressed: { opacity: 0.6 },
});
