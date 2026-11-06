import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { usePreferences } from '@/preferences/PreferencesProvider';
import { getCurrentLocation } from '@/utils/location';

import { deleteAlert, getMyAlert, roundForAlert, saveAlert, type RescueAlert } from './alerts';

export const alertKeys = {
  mine: (me: string) => ['rescueAlert', me] as const,
};

/** The signed-in user's nearby alert (`null` when it is off). */
export function useRescueAlert() {
  const { client, user, status } = useAuth();
  const me = user?.id ?? '';
  return useQuery({
    queryKey: alertKeys.mine(me),
    queryFn: () => getMyAlert(client, me),
    enabled: status === 'signedIn' && Boolean(me),
  });
}

/** Why turning the alert on did not work: no location permission, or the request failed. */
export class AlertLocationError extends Error {}

/**
 * Turns the alert on (asking for the location, then saving it approximately with the nearby
 * radius) or off (deleting it).
 */
export function useToggleRescueAlert() {
  const { client, user } = useAuth();
  const { nearbyRadiusKm } = usePreferences();
  const queryClient = useQueryClient();
  const me = user?.id ?? '';
  return useMutation({
    mutationFn: async ({ on, alert }: { on: boolean; alert: RescueAlert | null }) => {
      if (!on) {
        if (alert) await deleteAlert(client, alert.id);
        return null;
      }
      const location = await getCurrentLocation({ ask: true });
      if (!location.ok) throw new AlertLocationError(location.reason);
      return saveAlert(client, me, alert?.id ?? null, location.coords, nearbyRadiusKm);
    },
    onSuccess: (saved) => queryClient.setQueryData(alertKeys.mine(me), saved),
  });
}

/**
 * Keeps an alert that is on up to date: when the app opens (and when the nearby radius
 * changes), saves where the phone is now (without asking for the permission) and the radius.
 */
export function useRescueAlertSync() {
  const { client, user } = useAuth();
  const { nearbyRadiusKm } = usePreferences();
  const queryClient = useQueryClient();
  const { data: alert } = useRescueAlert();
  const alertId = alert?.id;

  const sync = useEffectEvent(async () => {
    if (!alert || !user) return;
    try {
      const location = await getCurrentLocation({ ask: false });
      const point = location.ok
        ? {
            latitude: roundForAlert(location.coords.latitude),
            longitude: roundForAlert(location.coords.longitude),
          }
        : { latitude: alert.latitude, longitude: alert.longitude };
      const unchanged =
        Math.abs(point.latitude - alert.latitude) < 1e-6 &&
        Math.abs(point.longitude - alert.longitude) < 1e-6 &&
        alert.radiusKm === nearbyRadiusKm;
      if (unchanged) return;
      const saved = await saveAlert(client, user.id, alert.id, point, nearbyRadiusKm);
      queryClient.setQueryData(alertKeys.mine(user.id), saved);
    } catch {
      // The alert keeps its last location; the next app open tries again.
    }
  });

  useEffect(() => {
    if (alertId) void sync();
  }, [alertId, nearbyRadiusKm]);
}
