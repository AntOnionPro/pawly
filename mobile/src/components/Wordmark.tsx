import { Image, StyleSheet } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';

/** Width / height of `assets/images/wordmark.png` (from `assets/brand/wordmark.svg`). */
const RATIO = 330 / 147;

interface WordmarkProps {
  /** Height in points; the width follows. */
  height?: number;
}

/**
 * "Pawly" written with the P of the logo (the cat), in the accent color of the theme. The
 * image is a black silhouette, so `tintColor` can paint it in any palette.
 */
export function Wordmark({ height = 34 }: WordmarkProps) {
  const colors = useThemeColors();
  return (
    <Image
      source={require('../../assets/images/wordmark.png')}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Pawly"
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      style={[styles.image, { height, width: height * RATIO, tintColor: colors.accent }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { flexShrink: 0 },
});
