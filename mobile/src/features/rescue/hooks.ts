import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import type { Point } from '@/utils/geo';

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
