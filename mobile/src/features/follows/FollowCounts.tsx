import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { User } from '@/auth/AuthProvider';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

function CountLink({
  count,
  label,
  onPress,
}: {
  count: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${count} ${label}`}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <ThemedText>
        <ThemedText style={styles.count}>{count}</ThemedText> {label}
      </ThemedText>
    </Pressable>
  );
}

/** Followers and followed users of a profile; each opens its list. */
export function FollowCounts({ user }: { user: User }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.row}>
      <CountLink
        count={user.followerCount}
        label={t('follows.followersLabel', { count: user.followerCount })}
        onPress={() => router.push({ pathname: '/user/[id]/followers', params: { id: user.id } })}
      />
      <CountLink
        count={user.followingCount}
        label={t('follows.followingLabel', { count: user.followingCount })}
        onPress={() => router.push({ pathname: '/user/[id]/following', params: { id: user.id } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  link: { minHeight: 44, justifyContent: 'center' },
  count: { fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
