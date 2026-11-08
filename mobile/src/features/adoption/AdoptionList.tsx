import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Icon } from '@/components/Icon';
import { FLOATING_ACTION_SPACE, FloatingAction } from '@/components/FloatingAction';
import { IconButton } from '@/components/IconButton';
import { Loading, LoadError } from '@/components/QueryState';
import { SearchField } from '@/components/SearchField';
import { ThemedText } from '@/components/ThemedText';
import { useBlockedIds } from '@/features/moderation/hooks';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { spacing } from '@/theme/typography';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

import type { AdoptionFilter } from './api';
import { AdoptionCard } from './AdoptionCard';
import { AdoptionFilters } from './AdoptionFilters';
import { useAdoptionList } from './hooks';

/**
 * Adoption tab: a list of pets up for adoption, newest first, with a search box and filters by
 * species, size, sex and date. Loads more at the end; pull down to refresh.
 */
export function AdoptionList() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { status } = useAuth();
  const [choices, setChoices] = useState<AdoptionFilter>({});
  const [search, setSearch] = useState('');
  // Searches once the person stops typing.
  const query = useDebouncedValue(search.trim());
  const filter: AdoptionFilter = query ? { ...choices, query } : choices;
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
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.header}>
              <Icon name="adoption" selected size={28} color={colors.accent} />
              <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
                {t('adoption.title')}
              </ThemedText>
              {status === 'signedIn' ? (
                <IconButton
                  icon="requests"
                  size={26}
                  label={t('adoptionRequests.sentTitle')}
                  onPress={() => router.push('/adoption/requests')}
                />
              ) : null}
            </View>
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder={t('adoption.search')}
            />
            <AdoptionFilters filter={choices} onChange={setChoices} />
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
        renderItem={({ item }) => (
          <AdoptionCard
            adoption={item}
            onPress={() => router.push({ pathname: '/adoption/[id]', params: { id: item.id } })}
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
      <FloatingAction
        icon="add"
        label={t('adoption.give')}
        onPress={() => router.push(status === 'signedIn' ? '/adoption/new' : '/sign-in')}
      />
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
  center: { textAlign: 'center', padding: spacing.lg },
  footer: { marginVertical: spacing.lg },
});
