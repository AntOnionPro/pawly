import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { FLOATING_ACTION_SPACE, FloatingAction } from '@/components/FloatingAction';
import { IconButton } from '@/components/IconButton';
import { Loading, LoadError } from '@/components/QueryState';
import { TabBar } from '@/components/TabBar';
import { ThemedText } from '@/components/ThemedText';
import { useBlockedIds } from '@/features/moderation/hooks';
import { usePreferences, useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { RESCUE_KINDS, type RescueKind, type RescueReport } from './api';
import { RescueCard } from './RescueCard';
import { useNearbyRescue, useRescueList } from './hooks';
import { mapsAvailable, RescueMap } from './maps';
import { useDeviceLocation, type DeviceLocationStatus } from './useDeviceLocation';

type KindTab = RescueKind | 'all';
type ListedReport = RescueReport & { distanceKm?: number };

/** Without the location: invite to use it (or explain how to turn it on). */
function LocationNote({
  status,
  onEnable,
}: {
  status: DeviceLocationStatus;
  onEnable: () => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  if (status === 'granted' || status === 'checking') return null;
  return (
    <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name="locate" size={20} color={colors.text} />
      <View style={styles.noteText}>
        <ThemedText>
          {status === 'denied' ? t('rescue.locationOffDenied') : t('rescue.locationOff')}
        </ThemedText>
        {status === 'denied' ? (
          <Button
            variant="link"
            label={t('rescue.openSettings')}
            onPress={() => void Linking.openSettings()}
          />
        ) : (
          <Button variant="link" label={t('rescue.enableLocation')} onPress={onEnable} />
        )}
      </View>
    </View>
  );
}

/**
 * Rescue tab: open cases filtered by kind. With the location, the cases within the nearby
 * radius, nearest first, as a list or on a map; without it, every open case, newest first.
 */
export function RescueList() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { status } = useAuth();
  const { nearbyRadiusKm } = usePreferences();
  const [tab, setTab] = useState<KindTab>('all');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<RescueReport | null>(null);
  const location = useDeviceLocation();
  const nearbyMode = location.point !== null;
  const filter = tab === 'all' ? {} : { kind: tab };
  // Every open case only once it is clear there is no location (no request while checking).
  const all = useRescueList(filter, !nearbyMode && location.status !== 'checking');
  const nearby = useNearbyRescue(location.point, nearbyRadiusKm, filter);
  const query = nearbyMode ? nearby : all;
  const blocked = useBlockedIds();
  const reports: ListedReport[] = (
    nearbyMode ? (nearby.data ?? []) : (all.data?.pages.flatMap((page) => page.items) ?? [])
  ).filter((report) => !blocked.has(report.reporterId));
  const showMap = view === 'map' && mapsAvailable;

  const open = (report: RescueReport) =>
    router.push({ pathname: '/rescue/[id]', params: { id: report.id } });

  const reportCase = (
    <FloatingAction
      icon="add"
      label={t('rescue.report')}
      onPress={() => router.push(status === 'signedIn' ? '/rescue/new' : '/sign-in')}
    />
  );

  const header = (
    <View style={styles.top}>
      <View style={styles.header}>
        <Icon name="rescue" selected size={28} color={colors.accent} />
        <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
          {t('rescue.title')}
        </ThemedText>
        {mapsAvailable ? (
          <IconButton
            icon={showMap ? 'list' : 'map'}
            size={26}
            label={showMap ? t('rescue.list') : t('rescue.map')}
            onPress={() => {
              setSelected(null);
              setView(showMap ? 'list' : 'map');
            }}
          />
        ) : null}
      </View>
      <TabBar<KindTab>
        tabs={[
          { value: 'all', label: t('rescue.all') },
          ...RESCUE_KINDS.map((kind) => ({ value: kind, label: t(`rescue.kindFilter.${kind}`) })),
        ]}
        selected={tab}
        onSelect={(value) => {
          setSelected(null);
          setTab(value);
        }}
      />
      <LocationNote status={location.status} onEnable={location.enable} />
      {nearbyMode ? (
        <View style={styles.nearby}>
          <ThemedText variant="caption" color="textSecondary" style={styles.nearbyText}>
            {t('rescue.nearbyHeading', { radius: nearbyRadiusKm })}
          </ThemedText>
          <Button
            variant="link"
            label={t('rescue.changeRadius')}
            onPress={() => router.push('/settings')}
          />
        </View>
      ) : null}
    </View>
  );

  const empty = query.isPending ? (
    <Loading />
  ) : query.error ? (
    <LoadError error={query.error} onRetry={() => void query.refetch()} />
  ) : (
    <ThemedText color="textSecondary" style={styles.center}>
      {nearbyMode
        ? t('rescue.nearbyEmpty', { radius: nearbyRadiusKm })
        : tab === 'all'
          ? t('rescue.empty')
          : t('rescue.emptyFiltered')}
    </ThemedText>
  );

  if (showMap) {
    const selectedReport = reports.find((report) => report.id === selected?.id);
    return (
      <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.mapHeader}>{header}</View>
        <View style={styles.mapArea}>
          <RescueMap
            reports={reports}
            center={location.point}
            radiusKm={nearbyRadiusKm}
            selectedId={selectedReport?.id ?? null}
            onSelect={setSelected}
          />
          {selectedReport ? (
            <View style={styles.selected}>
              <RescueCard
                report={selectedReport}
                distanceKm={selectedReport.distanceKm}
                onPress={() => open(selectedReport)}
              />
            </View>
          ) : null}
        </View>
        {/* The card of the chosen case takes the bottom of the map. */}
        {selectedReport ? null : reportCase}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        testID="rescue"
        data={reports}
        keyExtractor={(report) => report.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          all.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <RescueCard report={item} distanceKm={item.distanceKm} onPress={() => open(item)} />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (!nearbyMode && all.hasNextPage && !all.isFetchingNextPage) {
            void all.fetchNextPage();
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !all.isFetchingNextPage}
            onRefresh={() => void query.refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
      {reportCase}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: FLOATING_ACTION_SPACE,
    gap: spacing.md,
    flexGrow: 1,
  },
  top: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: { flex: 1, gap: spacing.xs, alignItems: 'flex-start' },
  nearby: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nearbyText: { flex: 1 },
  center: { textAlign: 'center', padding: spacing.lg },
  footer: { marginVertical: spacing.lg },
  mapHeader: { padding: spacing.md, paddingBottom: spacing.sm },
  mapArea: { flex: 1 },
  selected: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
});
