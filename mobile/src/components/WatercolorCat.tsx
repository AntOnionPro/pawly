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

/** The tallest the cat is drawn, and the least room it needs to be worth showing. */
const MAX_HEIGHT = 260;
const MIN_HEIGHT = 72;

interface WatercolorCatProps {
  /**
   * Fits in the room left at the bottom of the screen, so nothing needs scrolling to see it
   * whole (and does not show when there is too little room, for example with the keyboard
   * open). Without it the cat goes after the content (screens that scroll anyway).
   */
  fit?: boolean;
}

/**
 * One of the watercolor cats, chosen at random each time the screen opens. It goes last in a
 * screen's content, at the bottom, so it never sits under text. Decorative: screen readers
 * ignore it, and it takes no touches.
 */
export function WatercolorCat({ fit = false }: WatercolorCatProps) {
  const scheme = useColorSchemeName();
  const { width, height } = useWindowDimensions();
  const [name] = useState(() => {
    const cats = catsFor(scheme);
    return cats[Math.floor(Math.random() * cats.length)] ?? 'siamese';
  });
  // The room left under the content, once measured (only when fitting).
  const [room, setRoom] = useState<number | null>(null);
  const cat = WATERCOLOR_CATS[name];
  // Never wider than half the screen nor taller than MAX_HEIGHT; when fitting, never taller
  // than the room left; otherwise about a quarter of the screen.
  const largest = Math.min((width * 0.5) / cat.ratio, MAX_HEIGHT);
  const catHeight = fit ? Math.min(room ?? 0, largest) : Math.min(height * 0.28, largest);
  const shown = !fit || catHeight >= MIN_HEIGHT;
  return (
    <View
      testID="watercolor-cat"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={fit ? (event) => setRoom(event.nativeEvent.layout.height) : undefined}
      style={fit ? styles.fill : styles.after}>
      {shown ? (
        <Image
          testID={`watercolor-cat-${name}`}
          source={cat.source}
          resizeMode="contain"
          style={{ height: catHeight, width: catHeight * cat.ratio }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // After the content: in a screen that fills the visible height, `auto` takes the space above.
  after: { marginTop: 'auto', alignItems: 'center' },
  // Takes exactly the room left (flex basis 0: the image never makes it taller).
  fill: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
});
