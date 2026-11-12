import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import type { ShelterProfile } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { mapsLink } from '@/utils/location';

/** Whether a shelter or rescuer wrote anything in its profile. */
export function hasShelterInfo(shelter: ShelterProfile | undefined): shelter is ShelterProfile {
  if (!shelter) return false;
  return Boolean(
    shelter.zone ||
    shelter.location ||
    shelter.hours ||
    shelter.needs.length > 0 ||
    shelter.needsNote,
  );
}

/**
 * Where a verified shelter or rescuer is, when it attends and what it needs, on its profile.
 * Only what it filled in is shown.
 */
export function ShelterInfo({ shelter }: { shelter: ShelterProfile }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const location = shelter.location;
  const hasNeeds = shelter.needs.length > 0 || Boolean(shelter.needsNote);

  return (
    <View
      testID="shelter-info"
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {shelter.zone || location ? (
        <View style={styles.row}>
          <Icon name="location" size={20} color={colors.text} />
          <View style={styles.text}>
            {shelter.zone ? (
              <ThemedText accessibilityLabel={t('shelter.zoneLabel', { zone: shelter.zone })}>
                {shelter.zone}
              </ThemedText>
            ) : null}
            {location ? (
              <View style={styles.link}>
                <Button
                  variant="link"
                  icon="map"
                  label={t('rescue.openMaps')}
                  onPress={() => void Linking.openURL(mapsLink(location))}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {shelter.hours ? (
        <View style={styles.row}>
          <Icon name="clock" size={20} color={colors.text} />
          <ThemedText
            style={styles.text}
            accessibilityLabel={t('shelter.hoursLabel', { hours: shelter.hours })}>
            {shelter.hours}
          </ThemedText>
        </View>
      ) : null}
      {hasNeeds ? (
        <View style={styles.row}>
          <Icon name="adoption" size={20} color={colors.text} />
          <View style={styles.text}>
            <ThemedText variant="label" color="textSecondary">
              {t('shelter.needsHeading')}
            </ThemedText>
            {shelter.needs.length > 0 ? (
              <View style={styles.needs}>
                {shelter.needs.map((need) => (
                  <View key={need} style={[styles.need, { backgroundColor: colors.tabIndicator }]}>
                    <ThemedText variant="caption">{t(`shelter.needNames.${need}`)}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
            {shelter.needsNote ? <ThemedText>{shelter.needsNote}</ThemedText> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  link: { alignItems: 'flex-start' },
  needs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  need: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.md },
});
