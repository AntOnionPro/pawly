import { useSyncExternalStore } from 'react';

/**
 * Whether post videos play with sound. Videos start muted; once someone turns the sound on in one
 * video, the next ones also play with sound until they turn it off (for this session).
 */
let soundOn = false;
const listeners = new Set<() => void>();

export function setVideoSound(value: boolean): void {
  if (value === soundOn) return;
  soundOn = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVideoSound(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => soundOn,
    () => soundOn,
  );
}
