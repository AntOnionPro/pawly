import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { usePreferences } from '@/preferences/PreferencesProvider';
import { useReduceMotion } from '@/utils/useReduceMotion';

// Only the connection type is needed: no checks against an outside server for internet access.
NetInfo.configure({ reachabilityShouldRun: () => false });

/** The browser's data saver (`navigator.connection.saveData`, in Chromium browsers). */
function webSavesData(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * Whether videos may start on their own, following Settings ("Always", "Wi-Fi only" or "Never").
 * Never with "Reduce motion", nor with the browser's data saver. "Wi-Fi only" leaves out
 * mobile data and Wi-Fi from a phone's hotspot (a metered connection).
 */
export function useAutoplayAllowed(): boolean {
  const { autoplay } = usePreferences();
  const reduceMotion = useReduceMotion();
  const network = useNetInfo();
  if (reduceMotion || webSavesData() || autoplay === 'never') return false;
  if (autoplay === 'always') return true;
  const unmetered = network.type === 'wifi' || network.type === 'ethernet';
  return unmetered && network.details?.isConnectionExpensive !== true;
}
