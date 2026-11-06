import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Icon } from '@/components/Icon';
import { useColorSchemeName, useThemeColors } from '@/preferences/PreferencesProvider';
import { radius } from '@/theme/typography';
import { DEFAULT_POINT, regionAround, type Point } from '@/utils/geo';

import type { RescueKind, RescueReport } from './api';
import { KIND_ICONS } from './RescueCard';

/** Native maps (Apple Maps on iOS, Google Maps on Android). The web has none: maps.web.tsx. */
export const mapsAvailable = true;

/** Round marker with the icon of the report's kind. */
function KindMarker({ kind, selected }: { kind: RescueKind; selected: boolean }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.marker,
        {
          backgroundColor: selected ? colors.accent : colors.surface,
          borderColor: selected ? colors.surface : colors.accent,
        },
      ]}>
      <Icon
        name={KIND_ICONS[kind]}
        selected
        size={20}
        color={selected ? colors.onAccent : colors.accent}
      />
    </View>
  );
}

interface RescueMapProps {
  reports: RescueReport[];
  /** The person's location, if known: the map starts there and shows it. */
  center: Point | null;
  radiusKm: number;
  selectedId: string | null;
  onSelect: (report: RescueReport | null) => void;
}

/** Map of the Rescue tab: one marker per case; tapping one selects it. */
export function RescueMap({ reports, center, radiusKm, selectedId, onSelect }: RescueMapProps) {
  const { t } = useTranslation();
  const scheme = useColorSchemeName();
  const start = center ?? reports[0] ?? DEFAULT_POINT;
  return (
    <MapView
      testID="rescue-map"
      style={StyleSheet.absoluteFill}
      initialRegion={regionAround(start, center ? radiusKm : 25)}
      showsUserLocation={center !== null}
      userInterfaceStyle={scheme}
      onPress={() => onSelect(null)}
      accessibilityLabel={t('rescue.mapLabel')}>
      {reports.map((report) => (
        <Marker
          key={report.id}
          coordinate={{ latitude: report.latitude, longitude: report.longitude }}
          accessibilityLabel={t(`rescue.kinds.${report.kind}`)}
          onPress={(event) => {
            event.stopPropagation();
            onSelect(report);
          }}>
          <KindMarker kind={report.kind} selected={report.id === selectedId} />
        </Marker>
      ))}
    </MapView>
  );
}

/** Small map that shows where a report is. */
export function PointMap({ point, kind }: { point: Point; kind: RescueKind }) {
  const { t } = useTranslation();
  const scheme = useColorSchemeName();
  return (
    <View style={styles.small}>
      <MapView
        testID="point-map"
        style={StyleSheet.absoluteFill}
        initialRegion={regionAround(point, 0.5)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle={scheme}
        accessibilityLabel={t('rescue.location')}>
        <Marker coordinate={point}>
          <KindMarker kind={kind} selected />
        </Marker>
      </MapView>
    </View>
  );
}

interface PickMapProps {
  point: Point | null;
  kind: RescueKind | '';
  onChange: (point: Point) => void;
}

/** Map to place the report: tap it or drag the marker to adjust the point. */
export function PickMap({ point, kind, onChange }: PickMapProps) {
  const { t } = useTranslation();
  const scheme = useColorSchemeName();
  return (
    <View style={styles.small}>
      <MapView
        testID="pick-map"
        style={StyleSheet.absoluteFill}
        // A new point moves the map there (for example, after "Use my current location").
        key={point ? `${point.latitude},${point.longitude}` : 'empty'}
        initialRegion={point ? regionAround(point, 0.5) : regionAround(DEFAULT_POINT, 25)}
        userInterfaceStyle={scheme}
        accessibilityLabel={t('rescue.pickHint')}
        onPress={(event) => onChange(event.nativeEvent.coordinate)}>
        {point ? (
          <Marker
            coordinate={point}
            draggable
            onDragEnd={(event) => onChange(event.nativeEvent.coordinate)}>
            <KindMarker kind={kind || 'help'} selected />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

const MARKER = 36;

const styles = StyleSheet.create({
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { height: 200, borderRadius: radius.md, overflow: 'hidden' },
});
