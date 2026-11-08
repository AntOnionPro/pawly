import { Platform, type ViewStyle } from 'react-native';

/**
 * The widest the content gets on a big screen (a computer, a tablet): a centered column, as on
 * Instagram or X. On phones it changes nothing: they are narrower.
 */
export const COLUMN_WIDTH = 640;
/** Lists of rows with a photo (Adoption, Rescue) take a little more. */
export const WIDE_COLUMN_WIDTH = 760;

export function column(maxWidth: number = COLUMN_WIDTH): ViewStyle {
  return { width: '100%', maxWidth, alignSelf: 'center' };
}

/**
 * Room at the top of a tab screen for the tab bar. On the web it floats fixed over the content
 * (24 px from the top and 40 px tall); on iOS and Android it is at the bottom.
 */
export function tabBarTopSpace(): number {
  return Platform.OS === 'web' ? 72 : 0;
}
