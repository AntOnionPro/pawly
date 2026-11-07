import { useEffect, useEffectEvent, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { palette } from '@/theme/colors';

const useNativeDriver = Platform.OS !== 'web';

/**
 * A big paw print that pops up in the middle of a photo or video and fades away (after a double
 * tap). White with a shadow, so it shows on any photo. Decorative: screen readers ignore it, and
 * it never takes touches. `onEnd` runs when it has faded.
 */
export function PawBurst({ onEnd }: { onEnd: () => void }) {
  // Pops in (going a little past its size), stays a moment and fades out while growing a bit.
  const [pop] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const ended = useEffectEvent(onEnd);
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(pop, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver,
      }),
      Animated.delay(250),
      Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver }),
    ]);
    animation.start(({ finished }) => {
      if (finished) ended();
    });
    return () => animation.stop();
  }, [pop, fade]);

  return (
    <View
      testID="paw-burst"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.center]}>
      <Animated.View
        style={[
          styles.shadow,
          {
            opacity: Animated.multiply(
              pop.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
              fade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            ),
            transform: [
              {
                scale: Animated.add(
                  pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                  fade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.15] }),
                ),
              },
            ],
          },
        ]}>
        <Icon name="paw" selected size={96} color={palette.white} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  // A shadow with the shape of the paw print: iOS draws it from the shadow props; Android and the
  // web need a drop-shadow filter (their box shadows would draw a square).
  shadow: Platform.select({
    ios: {
      shadowColor: palette.black,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    android: {
      filter: [
        {
          dropShadow: {
            offsetX: 0,
            offsetY: 2,
            standardDeviation: 6,
            color: 'rgba(0, 0, 0, 0.35)',
          },
        },
      ],
    },
    default: { filter: 'drop-shadow(0px 2px 8px rgba(0, 0, 0, 0.35))' },
  }),
});
