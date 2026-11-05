import type { RecordSubscription } from 'pocketbase';
import { useEffect, useEffectEvent } from 'react';

import { useAuth } from '@/auth/AuthProvider';

/**
 * Listens to live changes of a collection (PocketBase realtime) while `enabled`. The server
 * only sends the records the user is allowed to see. If realtime is not available the screen
 * still works; it just does not update on its own.
 */
export function useRealtime(
  collection: string,
  options: { filter: string; expand?: string },
  enabled: boolean,
  onEvent: (event: RecordSubscription) => void,
) {
  const { client } = useAuth();
  const { filter, expand } = options;
  const handle = useEffectEvent(onEvent);
  useEffect(() => {
    if (!enabled) return undefined;
    let unsubscribe: (() => Promise<void>) | null = null;
    let active = true;
    try {
      client
        .collection(collection)
        .subscribe('*', (event) => handle(event), { filter, expand })
        .then((stop) => {
          if (active) unsubscribe = stop;
          else void stop();
        })
        .catch(() => undefined);
    } catch {
      // No realtime connection (for example in tests).
    }
    return () => {
      active = false;
      void unsubscribe?.().catch(() => undefined);
    };
  }, [client, collection, filter, expand, enabled]);
}
