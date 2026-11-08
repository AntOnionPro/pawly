import { useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useColorSchemeName } from '@/preferences/PreferencesProvider';

/**
 * The watercolor cats, dogs and rabbits (cut out of their painted background), with
 * width / height.
 */
export const WATERCOLOR_PETS = {
  blackCat: { source: require('../../assets/images/cats/gato-negro.png'), ratio: 370 / 487 },
  siameseCat: { source: require('../../assets/images/cats/gato-siames.png'), ratio: 342 / 527 },
  gingerCat: { source: require('../../assets/images/cats/gato-naranja.png'), ratio: 376 / 503 },
  husky: { source: require('../../assets/images/dogs/perro-husky.png'), ratio: 373 / 527 },
  pitbull: { source: require('../../assets/images/dogs/perro-pitbull.png'), ratio: 394 / 516 },
  dachshund: {
    source: require('../../assets/images/dogs/perro-salchicha.png'),
    ratio: 394 / 461,
  },
  lopRabbit: {
    source: require('../../assets/images/rabbits/conejo-orejon.png'),
    ratio: 227 / 339,
  },
  grayRabbit: { source: require('../../assets/images/rabbits/conejo-gris.png'), ratio: 233 / 354 },
} as const;
export type WatercolorPetName = keyof typeof WATERCOLOR_PETS;

const ALL_PETS = Object.keys(WATERCOLOR_PETS) as WatercolorPetName[];

/** The pets that show in a theme: the black cat would not be seen on the black of the dark one. */
export function petsFor(scheme: 'light' | 'dark'): WatercolorPetName[] {
  return scheme === 'dark' ? ALL_PETS.filter((name) => name !== 'blackCat') : ALL_PETS;
}

/** The tallest the pet is drawn, and the least room it needs to be worth showing. */
const MAX_HEIGHT = 260;
const MIN_HEIGHT = 72;

interface WatercolorPetProps {
  /**
   * Fits in the room left at the bottom of the screen, so nothing needs scrolling to see it
   * whole (and does not show when there is too little room, for example with the keyboard
   * open). Without it the pet goes after the content (screens that scroll anyway).
   */
  fit?: boolean;
}

/**
 * One of the watercolor cats, dogs and rabbits, chosen at random each time the screen opens. It goes last in a
 * screen's content, at the bottom, so it never sits under text. Decorative: screen readers
 * ignore it, and it takes no touches.
 */
export function WatercolorPet({ fit = false }: WatercolorPetProps) {
  const scheme = useColorSchemeName();
  const { width, height } = useWindowDimensions();
  const [name] = useState(() => {
    const pets = petsFor(scheme);
    return pets[Math.floor(Math.random() * pets.length)] ?? 'siameseCat';
  });
  // The room left under the content, once measured (only when fitting).
  const [room, setRoom] = useState<number | null>(null);
  const pet = WATERCOLOR_PETS[name];
  // Never wider than half the screen nor taller than MAX_HEIGHT; when fitting, never taller
  // than the room left; otherwise about a quarter of the screen.
  const largest = Math.min((width * 0.5) / pet.ratio, MAX_HEIGHT);
  const petHeight = fit ? Math.min(room ?? 0, largest) : Math.min(height * 0.28, largest);
  const shown = !fit || petHeight >= MIN_HEIGHT;
  return (
    <View
      testID="watercolor-pet"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={fit ? (event) => setRoom(event.nativeEvent.layout.height) : undefined}
      style={fit ? styles.fill : styles.after}>
      {shown ? (
        <Image
          testID={`watercolor-pet-${name}`}
          source={pet.source}
          resizeMode="contain"
          style={{ height: petHeight, width: petHeight * pet.ratio }}
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
