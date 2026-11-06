// react-native-maps has no web version: the web shows the list and the "Open in maps" link,
// and the report form takes the location from the browser.
import type { Point } from '@/utils/geo';

import type { RescueKind, RescueReport } from './api';

export const mapsAvailable = false;

export function RescueMap(_props: {
  reports: RescueReport[];
  center: Point | null;
  radiusKm: number;
  selectedId: string | null;
  onSelect: (report: RescueReport | null) => void;
}) {
  return null;
}

export function PointMap(_props: { point: Point; kind: RescueKind }) {
  return null;
}

export function PickMap(_props: {
  point: Point | null;
  kind: RescueKind | '';
  onChange: (point: Point) => void;
}) {
  return null;
}
