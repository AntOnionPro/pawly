import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useThemeColors } from '@/preferences/PreferencesProvider';
import type { IconName } from '@/theme/icons';
import { radius, spacing } from '@/theme/typography';

import { Icon } from './Icon';

/** Width of the window from which rows are wide (a tablet or a computer). */
export const WIDE_ROW_FROM = 600;
/** The photo: square on a phone, wider when the row is wide. */
export const ROW_PHOTO = 104;
export const WIDE_ROW_PHOTO = 184;

interface PhotoRowProps {
  /** The icon on the left (for example, the animal). */
  leading: ReactNode;
  /** URL of the photo on the right, or null. */
  photo: string | null;
  /** Without a photo: an icon in its place (for example, a video), or nothing. */
  placeholder?: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
  children: ReactNode;
}

/**
 * Row of a list such as Adoption or Rescue: an icon on the left, the text in the middle and
 * the photo filling the right side of the row, from top to bottom.
 */
export function PhotoRow({
  leading,
  photo,
  placeholder,
  accessibilityLabel,
  onPress,
  testID,
  children,
}: PhotoRowProps) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const photoWidth = width >= WIDE_ROW_FROM ? WIDE_ROW_PHOTO : ROW_PHOTO;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.leading, { backgroundColor: colors.background }]}>{leading}</View>
      <View style={styles.text}>{children}</View>
      {photo || placeholder ? (
        <View
          testID="row-photo"
          style={[styles.photo, { width: photoWidth, backgroundColor: colors.background }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : placeholder ? (
            <Icon name={placeholder} selected size={28} color={colors.textSecondary} />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const LEADING = 44;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    minHeight: ROW_PHOTO,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  leading: {
    width: LEADING,
    height: LEADING,
    borderRadius: LEADING / 2,
    marginLeft: spacing.md,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  photo: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.6 },
});
