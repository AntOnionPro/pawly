import { Ubuntu_300Light } from '@expo-google-fonts/ubuntu/300Light';
import { Ubuntu_400Regular } from '@expo-google-fonts/ubuntu/400Regular';
import { Ubuntu_500Medium } from '@expo-google-fonts/ubuntu/500Medium';
import { Ubuntu_700Bold } from '@expo-google-fonts/ubuntu/700Bold';
import type { TextStyle } from 'react-native';

/** The app's font (Ubuntu, the default) or the phone's own (San Francisco, Roboto). */
export type FontPreference = 'ubuntu' | 'system';

export const FONT_PREFERENCES: readonly FontPreference[] = ['ubuntu', 'system'];

/** Font files to load (expo-font), by the family name the styles use. */
export const UBUNTU_FILES = {
  Ubuntu_300Light,
  Ubuntu_400Regular,
  Ubuntu_500Medium,
  Ubuntu_700Bold,
};

type UbuntuFamily = keyof typeof UBUNTU_FILES;

/**
 * Ubuntu has light, regular, medium and bold. Each weight is its own family, so the weight
 * picks the file (Ubuntu has no semibold: 600 uses medium).
 */
function ubuntuFamily(weight: TextStyle['fontWeight']): UbuntuFamily {
  const value =
    weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight);
  if (value <= 300) return 'Ubuntu_300Light';
  if (value < 500) return 'Ubuntu_400Regular';
  if (value < 700) return 'Ubuntu_500Medium';
  return 'Ubuntu_700Bold';
}

/**
 * The font of a text with the given weight. With Ubuntu the weight is in the family, so
 * `fontWeight` goes back to normal (otherwise phones may fake a bolder one).
 */
export function fontFor(font: FontPreference, weight?: TextStyle['fontWeight']): TextStyle {
  if (font === 'system') return weight === undefined ? {} : { fontWeight: weight };
  return { fontFamily: ubuntuFamily(weight), fontWeight: 'normal' };
}
