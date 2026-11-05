import { Pressable, StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

/** Photo, @username and bio of a user in a list; opens their profile. */
export function UserRow({ user, onPress }: { user: User; onPress: () => void }) {
  const { client } = useAuth();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`@${user.username}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar uri={avatarUrl(client, user, '100x100')} username={user.username} size={44} />
      <View style={styles.names}>
        <ThemedText style={styles.username} numberOfLines={1}>
          @{user.username}
        </ThemedText>
        {user.bio ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            {user.bio}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  names: { flex: 1 },
  username: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
