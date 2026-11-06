import AsyncStorage from '@react-native-async-storage/async-storage';
import PocketBase, { AsyncAuthStore } from 'pocketbase';

import { suspensionFromBody, type Suspension } from '@/auth/suspension';

import { API_URL } from './config';
import { installEventSource } from './eventSource';

// Realtime (live messages) needs EventSource, which React Native does not have.
installEventSource();

export const AUTH_STORAGE_KEY = 'pawly:auth';

type SuspensionListener = (suspension: Suspension) => void;
const suspensionListeners = new WeakMap<PocketBase, Set<SuspensionListener>>();

/**
 * Calls `listener` when a request of the signed-in account is refused because the account is
 * suspended (the session is already closed by then). Returns a function that stops listening.
 */
export function onSuspended(pb: PocketBase, listener: SuspensionListener): () => void {
  const listeners = suspensionListeners.get(pb) ?? new Set<SuspensionListener>();
  suspensionListeners.set(pb, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

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
  // A session whose account was suspended stops working: close it at its first refusal.
  pb.afterSend = (response: Response, data: unknown) => {
    const suspension =
      response.status === 403 && pb.authStore.isValid ? suspensionFromBody(data) : null;
    if (suspension) {
      pb.authStore.clear();
      for (const listener of suspensionListeners.get(pb) ?? []) listener(suspension);
    }
    return data;
  };
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
