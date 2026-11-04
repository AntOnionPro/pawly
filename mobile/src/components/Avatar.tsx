import { Image, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';

import { ThemedText } from './ThemedText';

interface AvatarProps {
  /** Photo URL, or null to show the first letter of the username. */
  uri: string | null;
  username: string;
  size?: number;
}

/** Round profile photo. Decorative: the username is always shown next to it. */
export function Avatar({ uri, username, size = 96 }: AvatarProps) {
  const colors = useThemeColors();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <ThemedText variant="title" style={{ fontSize: size * 0.4, lineHeight: size * 0.5 }}>
          {username.charAt(0).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
