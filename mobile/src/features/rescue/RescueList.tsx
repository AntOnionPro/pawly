import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Loading, LoadError } from '@/components/QueryState';
import { TabBar } from '@/components/TabBar';
import { ThemedText } from '@/components/ThemedText';
import { useBlockedIds } from '@/features/moderation/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import { RESCUE_KINDS, type RescueKind } from './api';
import { RescueCard } from './RescueCard';
import { useRescueList } from './hooks';

type KindTab = RescueKind | 'all';

/** Rescue tab: open cases, newest first, filtered by kind. Pull down to refresh. */
export function RescueList() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { status } = useAuth();
  const [tab, setTab] = useState<KindTab>('all');
  const filter = tab === 'all' ? {} : { kind: tab };
  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRescueList(filter);
  const blocked = useBlockedIds();
  const reports = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (report) => !blocked.has(report.reporterId),
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        testID="rescue"
        data={reports}
        keyExtractor={(report) => report.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.header}>
              <Icon name="rescue" selected size={28} color={colors.accent} />
              <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
                {t('rescue.title')}
              </ThemedText>
              <IconButton
                icon="add"
                size={26}
                label={t('rescue.report')}
                onPress={() => router.push(status === 'signedIn' ? '/rescue/new' : '/sign-in')}
              />
            </View>
            <TabBar<KindTab>
              tabs={[
                { value: 'all', label: t('rescue.all') },
                ...RESCUE_KINDS.map((kind) => ({
                  value: kind,
                  label: t(`rescue.kindFilter.${kind}`),
                })),
              ]}
              selected={tab}
              onSelect={setTab}
            />
          </View>
        }
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : (
            <ThemedText color="textSecondary" style={styles.center}>
              {tab === 'all' ? t('rescue.empty') : t('rescue.emptyFiltered')}
            </ThemedText>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : undefined
        }
        renderItem={({ item }) => (
          <RescueCard
            report={item}
            onPress={() => router.push({ pathname: '/rescue/[id]', params: { id: item.id } })}
          />
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={() => void refetch()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  top: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  center: { textAlign: 'center', padding: spacing.lg },
  footer: { marginVertical: spacing.lg },
});
