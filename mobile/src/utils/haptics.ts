import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * A light tap felt when something is given (a paw print). On Android it uses the system's
 * "confirm" effect, which needs no vibration pattern. It never fails: the feedback is extra, and
 * phones without it (or older Android versions) simply feel nothing.
 */
export function giveFeedback(): void {
  const done =
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  done.catch(() => undefined);
}
