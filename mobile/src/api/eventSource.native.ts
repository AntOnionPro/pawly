import RNEventSource from 'react-native-sse';

/**
 * `EventSource` for PocketBase realtime on iOS and Android, which do not have one. The polyfill
 * only calls listeners, while PocketBase listens to `onerror` to reconnect: forward errors.
 */
class PocketBaseEventSource extends RNEventSource<string> {
  onerror: ((event: unknown) => void) | null = null;

  constructor(url: string | URL) {
    super(url);
    this.addEventListener('error', (event) => {
      this.onerror?.(event);
    });
  }
}

export function installEventSource(): void {
  const global = globalThis as { EventSource?: unknown };
  if (typeof global.EventSource === 'undefined') {
    global.EventSource = PocketBaseEventSource;
  }
}
