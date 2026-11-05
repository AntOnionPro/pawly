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

export const NOTIFICATION_PREFS = 'notification_prefs';

/** Push types the user can turn off. */
export type PushType = 'paw' | 'comment' | 'follow' | 'repost' | 'message' | 'adoption';

export const PUSH_TYPES: readonly PushType[] = [
  'paw',
  'comment',
  'follow',
  'repost',
  'message',
  'adoption',
];

/** `true` = the user wants pushes of that type. */
export type PushPrefs = Record<PushType, boolean>;

export interface SavedPushPrefs {
  /** Id of the saved record, or null while the user never changed anything (all on). */
  id: string | null;
  prefs: PushPrefs;
}

const ALL_ON: PushPrefs = {
  paw: true,
  comment: true,
  follow: true,
  repost: true,
  message: true,
  adoption: true,
};

export async function getPushPrefs(client: PocketBase, userId: string): Promise<SavedPushPrefs> {
  const result = await client.collection(NOTIFICATION_PREFS).getList(1, 1, {
    filter: client.filter('user = {:user}', { user: userId }),
    skipTotal: true,
  });
  const record = result.items[0];
  if (!record) return { id: null, prefs: { ...ALL_ON } };
  const prefs = { ...ALL_ON };
  for (const type of PUSH_TYPES) prefs[type] = !record[`${type}Off`];
  return { id: record.id, prefs };
}

/** Saves the preferences (the server stores which types are off). */
export async function savePushPrefs(
  client: PocketBase,
  userId: string,
  saved: SavedPushPrefs,
): Promise<string> {
  const body: Record<string, boolean> = {};
  for (const type of PUSH_TYPES) body[`${type}Off`] = !saved.prefs[type];
  const record = saved.id
    ? await client.collection(NOTIFICATION_PREFS).update(saved.id, body)
    : await client.collection(NOTIFICATION_PREFS).create({ user: userId, ...body });
  return record.id;
}
