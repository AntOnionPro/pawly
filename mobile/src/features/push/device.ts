import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

/** Banners and the notification list also show while the app is open. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** EAS project id (from `npx eas-cli init`), needed for Expo push tokens. */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return (
    Constants.easConfig?.projectId ??
    extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    undefined
  );
}

/**
 * Whether this phone can receive push: not in Expo Go on Android (removed since SDK 53, it
 * needs a development build) and only with an EAS project id.
 */
export function pushAvailable(): boolean {
  if (Platform.OS === 'android' && isRunningInExpoGo()) return false;
  return Boolean(projectId());
}

/** Whether this phone can show push: allowed, not allowed, not asked yet, or not possible. */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function getPushPermission(): Promise<PushPermission> {
  if (!pushAvailable()) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' || status === 'denied' ? status : 'undetermined';
}

/**
 * This phone's Expo push token, or null if push is not available or not allowed. With `ask`,
 * asks for permission if it was never asked.
 */
export async function getPushToken({ ask }: { ask: boolean }): Promise<string | null> {
  if (!pushAvailable()) return null;
  let { status } = await Notifications.getPermissionsAsync();
  if (status === 'undetermined' && ask) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Pawly',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  return data;
}

/** What a tapped push should open. */
export interface PushTarget {
  type?: string;
  postId?: string;
  actorId?: string;
  conversationId?: string;
}

/**
 * Calls `onOpen` with the data of the push that opened the app (if any) and of every push the
 * user taps later. Returns a function that stops listening.
 */
export function listenToPushTaps(onOpen: (target: PushTarget) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onOpen(response.notification.request.content.data as PushTarget);
  });
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) onOpen(response.notification.request.content.data as PushTarget);
  });
  return () => subscription.remove();
}
