import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Port where `server/` runs PocketBase during development. */
export const API_PORT = 8090;

interface ApiUrlSources {
  /** `EXPO_PUBLIC_API_URL`, if set. */
  envUrl?: string;
  /** Expo dev server address seen by the phone, e.g. "192.168.1.20:8081". */
  hostUri?: string | null;
  /** Browser hostname when running on the web. */
  webHostname?: string;
}

/**
 * Server URL. `EXPO_PUBLIC_API_URL` wins; otherwise, during development, the computer that
 * runs Expo is also the one running PocketBase, so the phone uses that same IP on port 8090.
 */
export function resolveApiUrl({ envUrl, hostUri, webHostname }: ApiUrlSources): string {
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  const host = hostUri?.split(':')[0] || webHostname || '127.0.0.1';
  return `http://${host}:${API_PORT}`;
}

interface WebUrlSources {
  /** `EXPO_PUBLIC_WEB_URL`, if set. */
  envUrl?: string;
  /** Expo dev server address seen by the phone, which also serves the web version. */
  hostUri?: string | null;
  /** Page origin when running on the web. */
  webOrigin?: string;
}

/**
 * Address of the web version, used in share links. `EXPO_PUBLIC_WEB_URL` wins (the real
 * domain from stage 8); otherwise, during development, the Expo dev server that serves it.
 */
export function resolveWebUrl({ envUrl, hostUri, webOrigin }: WebUrlSources): string {
  if (envUrl) return envUrl.replace(/\/+$/, '');
  if (webOrigin) return webOrigin;
  return `http://${hostUri || 'localhost:8081'}`;
}

export const API_URL = resolveApiUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  webHostname:
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined,
});

export const WEB_URL = resolveWebUrl({
  envUrl: process.env.EXPO_PUBLIC_WEB_URL,
  hostUri: Constants.expoConfig?.hostUri,
  webOrigin:
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined,
});
