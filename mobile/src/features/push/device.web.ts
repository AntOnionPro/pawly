import type { PushPermission, PushTarget } from './device';

export type { PushPermission, PushTarget } from './device';

/** The web version does not register for push. Native: device.ts. */
export function pushAvailable(): boolean {
  return false;
}

export async function getPushPermission(): Promise<PushPermission> {
  return 'unavailable';
}

export async function getPushToken(_options: { ask: boolean }): Promise<string | null> {
  return null;
}

export function listenToPushTaps(_onOpen: (target: PushTarget) => void): () => void {
  return () => undefined;
}
