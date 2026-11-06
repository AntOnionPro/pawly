import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import type { Point } from '@/utils/geo';

import { getMyOffer, listHelpOffers, offerHelp, withdrawHelp } from './helpers';

import {
  createRescueReport,
  deleteRescueReport,
  getRescueReport,
  listNearbyRescueReports,
  listRescueReports,
  setRescueStatus,
  updateRescueReport,
  type RescueFilter,
  type RescueReport,
  type RescueStatus,
  type RescueValues,
} from './api';

export const rescueKeys = {
  all: ['rescue'] as const,
  list: (filter: RescueFilter) => ['rescue', 'list', filter] as const,
  detail: (id: string) => ['rescue', 'detail', id] as const,
  nearby: (center: Point | null, radiusKm: number, filter: RescueFilter) =>
    ['rescue', 'nearby', center?.latitude, center?.longitude, radiusKm, filter] as const,
};

/** Open reports near `center` (disabled without a location), nearest first. */
export function useNearbyRescue(center: Point | null, radiusKm: number, filter: RescueFilter) {
  const { client } = useAuth();
  return useQuery({
    queryKey: rescueKeys.nearby(center, radiusKm, filter),
    queryFn: () => listNearbyRescueReports(client, center as Point, radiusKm, filter),
    enabled: center !== null,
  });
}

/** Pages of open reports, newest first. */
export function useRescueList(filter: RescueFilter, enabled = true) {
  const { client } = useAuth();
  return useInfiniteQuery({
    queryKey: rescueKeys.list(filter),
    queryFn: ({ pageParam }) => listRescueReports(client, filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled,
  });
}

export function useRescueReport(id: string | undefined) {
  const { client } = useAuth();
  return useQuery({
    queryKey: rescueKeys.detail(id ?? ''),
    queryFn: () => getRescueReport(client, id ?? ''),
    enabled: Boolean(id),
  });
}

/** Creates a report, or updates it when `id` is given, and refreshes every report. */
export function useSaveRescueReport() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: RescueValues }): Promise<RescueReport> =>
      id
        ? updateRescueReport(client, id, values)
        : createRescueReport(client, user?.id ?? '', values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rescueKeys.all }),
  });
}

export function useSetRescueStatus() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RescueStatus }) =>
      setRescueStatus(client, id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rescueKeys.all }),
  });
}

export function useDeleteRescueReport() {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRescueReport(client, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rescueKeys.all }),
  });
}

export const helpKeys = {
  all: ['rescueHelp'] as const,
  mine: (me: string, reportId: string) => ['rescueHelp', 'mine', me, reportId] as const,
  forReport: (reportId: string) => ['rescueHelp', 'report', reportId] as const,
};

/** The signed-in user's offer to help with a report (`null` when none). */
export function useMyOffer(reportId: string, enabled: boolean) {
  const { client, user } = useAuth();
  const me = user?.id ?? '';
  return useQuery({
    queryKey: helpKeys.mine(me, reportId),
    queryFn: () => getMyOffer(client, me, reportId),
    enabled: enabled && Boolean(me),
  });
}

/** Everyone who offered to help, for the reporter. */
export function useHelpOffers(reportId: string, enabled: boolean) {
  const { client } = useAuth();
  return useQuery({
    queryKey: helpKeys.forReport(reportId),
    queryFn: () => listHelpOffers(client, reportId),
    enabled,
  });
}

/** Offers or withdraws help; the report's count and status change, so reports refresh too. */
export function useHelpActions() {
  const { client, user } = useAuth();
  const queryClient = useQueryClient();
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: helpKeys.all });
    await queryClient.invalidateQueries({ queryKey: rescueKeys.all });
  };
  const offer = useMutation({
    mutationFn: ({ reportId, message }: { reportId: string; message: string }) =>
      offerHelp(client, user?.id ?? '', reportId, message),
    onSuccess: refresh,
  });
  const withdraw = useMutation({
    mutationFn: (offerId: string) => withdrawHelp(client, offerId),
    onSuccess: refresh,
  });
  return { offer, withdraw };
}
