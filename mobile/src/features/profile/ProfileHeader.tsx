import { StyleSheet, View } from 'react-native';

import type { User } from '@/auth/AuthProvider';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

/** Photo, @username and bio of a profile. */
export function ProfileHeader({ user }: { user: User }) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <View
        accessible={false}
        style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ThemedText variant="title">{user.username.charAt(0).toUpperCase()}</ThemedText>
      </View>
      <ThemedText variant="heading" accessibilityRole="header">
        @{user.username}
      </ThemedText>
      {user.bio ? <ThemedText style={styles.bio}>{user.bio}</ThemedText> : null}
    </View>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bio: { textAlign: 'center' },
});
