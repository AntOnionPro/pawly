import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';
import { useReduceMotion } from '@/utils/useReduceMotion';

interface PawButtonProps {
  count: number;
  pawed: boolean;
  onPress?: () => void;
}

/** The web has no native animation driver. */
const useNativeDriver = Platform.OS !== 'web';

/**
 * The paw print reaction: filled with the accent color when given, with its count. When the
 * paw print is given, it grows and bounces back (not with "Reduce motion").
 */
export function PawButton({ count, pawed, onPress }: PawButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const scale = useBounce(pawed);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pawed ? t('posts.paw.remove') : t('posts.paw.add')}
      accessibilityHint={t('posts.paw.count', { count })}
      accessibilityState={{ selected: pawed, disabled: !onPress }}
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Animated.View testID="paw-icon" style={{ transform: [{ scale }] }}>
        <Icon name="paw" selected={pawed} size={26} color={pawed ? colors.accent : colors.text} />
      </Animated.View>
      <ThemedText style={styles.count}>{count}</ThemedText>
    </Pressable>
  );
}

/** A scale that bounces each time `on` turns true (not when it starts true). */
function useBounce(on: boolean): Animated.Value {
  const reduceMotion = useReduceMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const wasOn = useRef(on);
  useEffect(() => {
    const turnedOn = on && !wasOn.current;
    wasOn.current = on;
    if (!turnedOn || reduceMotion) return;
    const bounce = Animated.sequence([
      Animated.timing(scale, { toValue: 1.4, duration: 110, useNativeDriver }),
      // Goes a little past its size and back: the bounce.
      Animated.timing(scale, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.back(3)),
        useNativeDriver,
      }),
    ]);
    bounce.start();
    return () => {
      bounce.stop();
      scale.setValue(1);
    };
  }, [on, reduceMotion, scale]);
  return scale;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    paddingRight: spacing.sm,
  },
  count: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
