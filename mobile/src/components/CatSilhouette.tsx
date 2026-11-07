import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';

/** Width / height of `assets/images/cat-silhouette.png` (the logo's cat, in black). */
const RATIO = 524 / 600;
/**
 * Barely visible: decoration only. Text on top of it must stay readable: at 4% even the
 * secondary text of every palette keeps 4.5:1 (checked in __tests__/cat-silhouette.test.tsx).
 */
export const SILHOUETTE_OPACITY = 0.04;

/**
 * The cat of the logo, very faint, at the bottom right of the screen behind the content.
 * Decorative: screen readers ignore it, and it never takes touches.
 */
export function CatSilhouette() {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  // About three quarters of the screen width, partly outside the screen.
  const catWidth = Math.min(width, 520) * 0.75;
  return (
    <View
      testID="cat-silhouette"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}>
      <Image
        testID="cat-silhouette-image"
        source={require('../../assets/images/cat-silhouette.png')}
        resizeMode="contain"
        style={[
          styles.cat,
          {
            width: catWidth,
            height: catWidth / RATIO,
            right: -catWidth * 0.18,
            bottom: -catWidth * 0.1,
            tintColor: colors.text,
            opacity: SILHOUETTE_OPACITY,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cat: { position: 'absolute' },
});
