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

export const API_URL = resolveApiUrl({
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  webHostname:
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined,
});
