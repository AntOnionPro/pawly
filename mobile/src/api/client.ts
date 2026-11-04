import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { AsyncAuthStore } from 'pocketbase';

import { API_URL } from './config';

export const AUTH_STORAGE_KEY = 'pawly:auth';

/**
 * PocketBase client whose session is saved on the phone. The saved session is loaded by
 * `AuthProvider` (see `restoreSession`) so the app knows exactly when it is ready.
 */
export function createClient(url: string = API_URL): PocketBase {
  const store = new AsyncAuthStore({
    save: (serialized) => AsyncStorage.setItem(AUTH_STORAGE_KEY, serialized),
    clear: () => AsyncStorage.removeItem(AUTH_STORAGE_KEY),
  });
  const pb = new PocketBase(url, store);
  // Screens can repeat the same request (e.g. re-renders); never cancel them automatically.
  pb.autoCancellation(false);
  return pb;
}

/** Loads the session saved by a previous run into the client. */
export async function restoreSession(pb: PocketBase): Promise<void> {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const { token, record } = JSON.parse(raw) as { token?: string; record?: unknown };
    if (token) {
      pb.authStore.save(token, (record ?? null) as never);
    }
  } catch {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

let shared: PocketBase | null = null;

/** The app-wide client. */
export function getClient(): PocketBase {
  shared ??= createClient();
  return shared;
}
