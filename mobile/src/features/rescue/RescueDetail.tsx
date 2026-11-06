import { useTranslation } from 'react-i18next';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { MessageButton } from '@/features/messages/MessageButton';
import { petPhotoUrl } from '@/features/pets/api';
import { MediaCarousel } from '@/features/posts/MediaCarousel';
import { UserLink } from '@/features/users/UserLink';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { mapsLink } from '@/utils/location';
import { notify } from '@/utils/notify';
import { useRelativeDate } from '@/utils/useRelativeDate';

import type { RescueReport, RescueStatus } from './api';
import { useSetRescueStatus } from './hooks';
import { KIND_ICONS, useRescueDetail } from './RescueCard';

interface RescueDetailProps {
  report: RescueReport;
  onPressPet: (petId: string) => void;
  onPressUser: (userId: string) => void;
  /** Shown only to the reporter. */
  onEdit?: () => void;
}

/** The reporter moves the case along: in progress and resolved, or reunited, or reopen. */
function StatusActions({ report }: { report: RescueReport }) {
  const { t } = useTranslation();
  const setStatus = useSetRescueStatus();
  const change = (status: RescueStatus) =>
    setStatus.mutate({ id: report.id, status }, { onError: () => notify(t('rescue.failed')) });
  const actions: { status: RescueStatus; label: string }[] =
    report.status === 'closed'
      ? [{ status: 'open', label: t('rescue.reopen') }]
      : report.kind === 'help'
        ? [
            ...(report.status === 'open'
              ? [{ status: 'in_progress' as const, label: t('rescue.markInProgress') }]
              : []),
            { status: 'closed', label: t('rescue.markResolved') },
          ]
        : [{ status: 'closed', label: t('rescue.markReunited') }];
  return (
    <View style={styles.actions}>
      {actions.map((action) => (
        <Button
          key={action.status}
          variant={action.status === 'closed' ? 'primary' : 'secondary'}
          label={action.label}
          onPress={() => change(action.status)}
          disabled={setStatus.isPending}
        />
      ))}
    </View>
  );
}

/** Full rescue report: photos and videos, kind and status, description, place and reporter. */
export function RescueDetail({ report, onPressPet, onPressUser, onEdit }: RescueDetailProps) {
  const { t } = useTranslation();
  const { client, user } = useAuth();
  const colors = useThemeColors();
  const detail = useRescueDetail(report);
  const date = useRelativeDate(report.created);
  const reporter = report.reporter;
  const isReporter = user?.id === report.reporterId;
  const petPhoto = report.pet ? petPhotoUrl(client, report.pet) : null;

  return (
    <View style={styles.container}>
      {report.media.length > 0 ? (
        <MediaCarousel record={report} />
      ) : petPhoto ? (
        <Image
          source={{ uri: petPhoto }}
          style={styles.petPhoto}
          accessibilityLabel={report.pet?.name}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.titleRow}>
        <Icon name={KIND_ICONS[report.kind]} selected size={26} color={colors.accent} />
        <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
          {t(`rescue.kinds.${report.kind}`)}
        </ThemedText>
        {/* An open lost or found case is already named by its kind. */}
        {report.kind === 'help' || report.status === 'closed' ? (
          <View style={[styles.status, { backgroundColor: colors.tabIndicator }]}>
            <ThemedText variant="caption" style={styles.statusText}>
              {t(`rescue.status.${report.kind}.${report.status}`)}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText variant="caption" color="textSecondary">
        {[detail, date].filter(Boolean).join(' · ')}
      </ThemedText>
      <ThemedText>{report.description}</ThemedText>

      <View style={[styles.place, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.placeRow}>
          <Icon name="location" size={20} color={colors.text} />
          <ThemedText style={styles.placeText}>{report.place || t('rescue.location')}</ThemedText>
        </View>
        <Button
          variant="link"
          icon="map"
          label={t('rescue.openMaps')}
          onPress={() => void Linking.openURL(mapsLink(report))}
        />
      </View>

      {report.pet ? (
        <Button
          variant="secondary"
          icon="paw"
          label={t('adoption.openPet', { name: report.pet.name })}
          onPress={() => onPressPet(report.petId)}
        />
      ) : null}
      {reporter ? (
        <UserLink
          user={reporter}
          label={t('rescue.reportedBy', { username: reporter.username })}
          onPress={() => onPressUser(reporter.id)}
        />
      ) : null}
      {!isReporter ? <MessageButton userId={report.reporterId} /> : null}
      {isReporter ? <StatusActions report={report} /> : null}
      {onEdit ? (
        <Button variant="secondary" icon="edit" label={t('rescue.edit')} onPress={onEdit} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  petPhoto: { width: '100%', aspectRatio: 1, borderRadius: radius.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  status: { borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontWeight: '600' },
  place: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  placeText: { flex: 1 },
  actions: { gap: spacing.sm },
});
