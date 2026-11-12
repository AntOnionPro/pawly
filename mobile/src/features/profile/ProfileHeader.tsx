import { StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { ThemedText } from '@/components/ThemedText';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { FollowCounts } from '@/features/follows/FollowCounts';
import { spacing } from '@/theme/typography';

import { hasShelterInfo, ShelterInfo } from './ShelterInfo';

/**
 * Photo, @username, bio and follower counts of a profile. A verified shelter or rescuer shows
 * its public name first, the badge under its @username and, at the end, where it is, when it
 * attends and what it needs.
 */
export function ProfileHeader({ user }: { user: User }) {
  const { client } = useAuth();
  return (
    <View style={styles.container}>
      <Avatar uri={avatarUrl(client, user)} username={user.username} />
      {user.accountKind ? (
        <>
          <ThemedText variant="heading" accessibilityRole="header" style={styles.name}>
            {user.publicName}
          </ThemedText>
          <ThemedText color="textSecondary">@{user.username}</ThemedText>
          <VerifiedBadge kind={user.accountKind} showLabel />
        </>
      ) : (
        <ThemedText variant="heading" accessibilityRole="header">
          @{user.username}
        </ThemedText>
      )}
      {user.bio ? <ThemedText style={styles.bio}>{user.bio}</ThemedText> : null}
      <FollowCounts user={user} />
      {user.accountKind && hasShelterInfo(user.shelter) ? (
        <ShelterInfo shelter={user.shelter} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  name: { textAlign: 'center' },
  bio: { textAlign: 'center' },
});
