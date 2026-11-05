import AsyncStorage from '@react-native-async-storage/async-storage';
import type PocketBase from 'pocketbase';

export const PUSH_TOKENS = 'push_tokens';
/** The Expo push token saved for this phone, to remove it when signing out. */
export const PUSH_TOKEN_KEY = 'pawly:pushToken';

export type PushPlatform = 'ios' | 'android' | 'web';
export type PushLanguage = 'es' | 'en';

/** Saves this phone's token for the user (the server moves it if another account had it). */
export async function savePushToken(
  client: PocketBase,
  userId: string,
  token: string,
  platform: PushPlatform,
  language: PushLanguage,
): Promise<void> {
  await client.collection(PUSH_TOKENS).create({ user: userId, token, platform, language });
  await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
}

/**
 * Stops pushes to this phone after signing out. Runs with the session that just ended
 * (`authToken`), because the client no longer has it. Errors are ignored: the server also
 * deletes tokens Expo stops recognizing.
 */
export async function forgetPushToken(client: PocketBase, authToken: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    if (!token || !authToken) return;
    const headers = { Authorization: authToken };
    const record = await client
      .collection(PUSH_TOKENS)
      .getFirstListItem(client.filter('token = {:token}', { token }), { headers });
    await client.collection(PUSH_TOKENS).delete(record.id, { headers });
  } catch {
    // Nothing else to do.
  }
}
