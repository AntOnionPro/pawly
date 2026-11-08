import { useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useColorSchemeName } from '@/preferences/PreferencesProvider';

/** The three watercolor cats (cut out of their painted background), with width / height. */
export const WATERCOLOR_CATS = {
  black: { source: require('../../assets/images/cats/gato-negro.png'), ratio: 370 / 487 },
  siamese: { source: require('../../assets/images/cats/gato-siames.png'), ratio: 342 / 527 },
  ginger: { source: require('../../assets/images/cats/gato-naranja.png'), ratio: 376 / 503 },
} as const;
export type WatercolorCatName = keyof typeof WATERCOLOR_CATS;

/** The cats that show in a theme: the black one would not be seen on the black of the dark one. */
export function catsFor(scheme: 'light' | 'dark'): WatercolorCatName[] {
  return scheme === 'dark' ? ['siamese', 'ginger'] : ['black', 'siamese', 'ginger'];
}

/**
 * One of the watercolor cats, chosen at random each time the screen opens. It goes last in a
 * screen's content: pushed to the bottom when the content is short, after it when it is long,
 * so it never sits under text. Decorative: screen readers ignore it, and it takes no touches.
 */
export function WatercolorCat() {
  const scheme = useColorSchemeName();
  const { width, height } = useWindowDimensions();
  const [name] = useState(() => {
    const cats = catsFor(scheme);
    return cats[Math.floor(Math.random() * cats.length)] ?? 'siamese';
  });
  const cat = WATERCOLOR_CATS[name];
  // About a quarter of the screen high, and never wider than half of it.
  const catHeight = Math.min(height * 0.28, (width * 0.5) / cat.ratio, 260);
  return (
    <View
      testID="watercolor-cat"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.place}>
      <Image
        testID={`watercolor-cat-${name}`}
        source={cat.source}
        resizeMode="contain"
        style={{ height: catHeight, width: catHeight * cat.ratio }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // In a scroll view that grows to the screen, `auto` takes the space left above.
  place: { marginTop: 'auto', alignItems: 'center' },
});
