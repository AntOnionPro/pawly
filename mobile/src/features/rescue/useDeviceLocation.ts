import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { Point } from '@/utils/geo';
import { getCurrentLocation, type LocationResult } from '@/utils/location';

export type DeviceLocationStatus =
  'checking' | 'granted' | 'undetermined' | 'denied' | 'unavailable';

const LOCATION_KEY = ['deviceLocation'] as const;

/** Rounded to about 100 m: enough for distances, and stable while the phone barely moves. */
function rounded(result: LocationResult): Point | null {
  if (!result.ok) return null;
  return {
    latitude: Math.round(result.coords.latitude * 1000) / 1000,
    longitude: Math.round(result.coords.longitude * 1000) / 1000,
  };
}

/**
 * Where the phone is, read when the screen opens without asking for the permission.
 * `enable()` asks for it (the first time) and reads the location again.
 */
export function useDeviceLocation() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: LOCATION_KEY,
    queryFn: () => getCurrentLocation({ ask: false }),
    staleTime: 5 * 60 * 1000,
  });
  const status: DeviceLocationStatus = !data ? 'checking' : data.ok ? 'granted' : data.reason;
  return {
    status,
    point: data ? rounded(data) : null,
    enable: () => {
      void getCurrentLocation({ ask: true }).then((result) =>
        queryClient.setQueryData(LOCATION_KEY, result),
      );
    },
  };
}
