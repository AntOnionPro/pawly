import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { useBlockedIds } from '@/features/moderation/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';

import type { AdoptionFilter } from './api';
import { AdoptionCard } from './AdoptionCard';
import { AdoptionFilters } from './AdoptionFilters';
import { useAdoptionList } from './hooks';

/**
 * Adoption tab: pets up for adoption in two columns, newest first, with filters by species,
 * size and sex. Loads more at the end; pull down to refresh.
 */
export function AdoptionList() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { status } = useAuth();
  const [filter, setFilter] = useState<AdoptionFilter>({});
  const {
    data,
    error,
    isPending,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdoptionList(filter);
  const blocked = useBlockedIds();
  const adoptions = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (adoption) => !blocked.has(adoption.publisherId),
  );
  const filtered = Object.values(filter).some(Boolean);

  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        testID="adoptions"
        data={adoptions}
        keyExtractor={(adoption) => adoption.id}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.header}>
              <Icon name="adoption" selected size={28} color={colors.accent} />
              <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
                {t('adoption.title')}
              </ThemedText>
              <IconButton
                icon="add"
                size={26}
                label={t('adoption.give')}
                onPress={() => router.push(status === 'signedIn' ? '/adoption/new' : '/sign-in')}
              />
            </View>
            <AdoptionFilters filter={filter} onChange={setFilter} />
          </View>
        }
        ListEmptyComponent={
          isPending ? (
            <Loading />
          ) : error ? (
            <LoadError error={error} onRetry={() => void refetch()} />
          ) : (
            <ThemedText color="textSecondary" style={styles.center}>
              {filtered ? t('adoption.emptyFiltered') : t('adoption.empty')}
            </ThemedText>
          )
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <View
            style={[styles.cell, index === adoptions.length - 1 && index % 2 === 0 && styles.half]}>
            <AdoptionCard
              adoption={item}
              onPress={() => router.push({ pathname: '/adoption/[id]', params: { id: item.id } })}
            />
          </View>
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
  columns: { gap: spacing.md },
  cell: { flex: 1 },
  // A last card alone in its row keeps the width of one column.
  half: { maxWidth: '50%', paddingRight: spacing.md / 2 },
  center: { textAlign: 'center', padding: spacing.lg },
  footer: { marginVertical: spacing.lg },
});
