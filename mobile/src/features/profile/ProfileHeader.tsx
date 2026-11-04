import { StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

/** Photo, @username and bio of a profile. */
export function ProfileHeader({ user }: { user: User }) {
  const { client } = useAuth();
  return (
    <View style={styles.container}>
      <Avatar uri={avatarUrl(client, user)} username={user.username} />
      <ThemedText variant="heading" accessibilityRole="header">
        @{user.username}
      </ThemedText>
      {user.bio ? <ThemedText style={styles.bio}>{user.bio}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  bio: { textAlign: 'center' },
});
