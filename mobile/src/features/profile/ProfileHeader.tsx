import { StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { ThemedText } from '@/components/ThemedText';
import { FollowCounts } from '@/features/follows/FollowCounts';
import { spacing } from '@/theme/typography';

/** Photo, @username, bio and follower counts of a profile. */
export function ProfileHeader({ user }: { user: User }) {
  const { client } = useAuth();
  return (
    <View style={styles.container}>
      <Avatar uri={avatarUrl(client, user)} username={user.username} />
      <ThemedText variant="heading" accessibilityRole="header">
        @{user.username}
      </ThemedText>
      {user.bio ? <ThemedText style={styles.bio}>{user.bio}</ThemedText> : null}
      <FollowCounts user={user} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  bio: { textAlign: 'center' },
});
