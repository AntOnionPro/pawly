import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import type { Point } from '@/utils/geo';
import { getCurrentLocation } from '@/utils/location';

import type { RescueKind } from './api';
import { mapsAvailable, PickMap } from './maps';

type LocationState = 'idle' | 'locating' | 'denied' | 'unavailable';

interface LocationFieldProps {
  label: string;
  point: Point | null;
  /** How exact the phone's reading was, in meters (when the point came from the phone). */
  accuracy: number | null;
  error?: string | null;
  /** The marker on the map: the kind of rescue case, or none in particular. */
  kind?: RescueKind | '';
  onLocated: (point: Point, accuracy: number | null) => void;
  /** For an optional point: takes it off again. */
  onClear?: () => void;
}

/** A GPS point: taken from the phone, and adjusted on the map (not on the web). */
export function LocationField({
  label,
  point,
  accuracy,
  error,
  kind = '',
  onLocated,
  onClear,
}: LocationFieldProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [state, setState] = useState<LocationState>('idle');

  async function locate() {
    setState('locating');
    const result = await getCurrentLocation();
    if (result.ok) {
      setState('idle');
      onLocated(
        { latitude: result.coords.latitude, longitude: result.coords.longitude },
        result.coords.accuracy ?? null,
      );
    } else {
      setState(result.reason === 'unavailable' ? 'unavailable' : 'denied');
    }
  }

  return (
    <View style={styles.location}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <View
        style={[
          styles.locationBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        {point ? (
          <View style={styles.locationRow}>
            <Icon name="locate" selected size={20} color={colors.accent} />
            <ThemedText style={styles.locationText}>
              {accuracy
                ? t('rescue.locationReady', { meters: Math.round(accuracy) })
                : t('rescue.locationSaved')}
            </ThemedText>
          </View>
        ) : null}
        {state === 'denied' ? (
          <>
            <ThemedText color="textSecondary">{t('rescue.locationDenied')}</ThemedText>
            <Button
              variant="link"
              label={t('rescue.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          </>
        ) : null}
        {state === 'unavailable' ? (
          <ThemedText color="textSecondary">{t('rescue.locationUnavailable')}</ThemedText>
        ) : null}
        <Button
          variant="secondary"
          icon="locate"
          label={point ? t('rescue.updateLocation') : t('rescue.useLocation')}
          onPress={() => void locate()}
          loading={state === 'locating'}
        />
        {point && onClear ? (
          <Button
            variant="link"
            icon="delete"
            label={t('rescue.clearLocation')}
            onPress={onClear}
          />
        ) : null}
        {mapsAvailable ? (
          <>
            <PickMap point={point} kind={kind} onChange={(picked) => onLocated(picked, null)} />
            <ThemedText variant="caption" color="textSecondary">
              {t('rescue.pickHint')}
            </ThemedText>
          </>
        ) : null}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  location: { gap: spacing.xs },
  locationBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationText: { flex: 1 },
});
