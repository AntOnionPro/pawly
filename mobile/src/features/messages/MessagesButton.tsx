import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { useUnreadConversations } from './hooks';

/** Messages icon for the top bar, with the number of unread conversations. */
export function MessagesButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { data: unread = 0 } = useUnreadConversations();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('messages.title')}
      accessibilityHint={unread > 0 ? t('messages.unread', { count: unread }) : undefined}
      hitSlop={8}
      onPress={() => router.push('/messages')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name="messages" size={26} color={colors.text} />
      {unread > 0 ? (
        // Text color on background color: readable at this small size in both themes.
        <View style={[styles.badge, { backgroundColor: colors.text }]}>
          <ThemedText style={[styles.count, { color: colors.background }]}>
            {unread > 9 ? '9+' : unread}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: spacing.xs },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  pressed: { opacity: 0.6 },
});
