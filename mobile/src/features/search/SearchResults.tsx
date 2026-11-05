import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { PetRow } from '@/features/pets/PetRow';
import { PostGrid } from '@/features/posts/PostGrid';
import { UserRow } from '@/features/users/UserRow';
import { spacing } from '@/theme/typography';

import type { SearchPage } from './api';
import { usePetSearch, useUserSearch } from './hooks';

export type SearchTab = 'users' | 'pets' | 'posts';

function Message({ children }: { children: ReactNode }) {
  return (
    <ThemedText color="textSecondary" style={styles.message}>
      {children}
    </ThemedText>
  );
}

/** Loading, error, "no results", the results and "show more" of a paged search. */
function Results<T extends { id: string }>({
  query,
  search,
  renderItem,
}: {
  query: string;
  search: UseInfiniteQueryResult<InfiniteData<SearchPage<T>>>;
  renderItem: (item: T) => ReactNode;
}) {
  const { t } = useTranslation();
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    search;
  const items = data?.pages.flatMap((page) => page.items) ?? [];
  if (isPending) return <Loading />;
  if (error) return <LoadError error={error} onRetry={() => void refetch()} />;
  if (items.length === 0) return <Message>{t('search.noResults', { query })}</Message>;
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id}>{renderItem(item)}</View>
      ))}
      {hasNextPage ? (
        <Button
          variant="secondary"
          label={t('posts.loadMore')}
          loading={isFetchingNextPage}
          onPress={() => void fetchNextPage()}
        />
      ) : null}
    </View>
  );
}

function UserResults({ query }: { query: string }) {
  const router = useRouter();
  const search = useUserSearch(query);
  return (
    <Results
      query={query}
      search={search}
      renderItem={(user) => (
        <UserRow
          user={user}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
        />
      )}
    />
  );
}

function PetResults({ query }: { query: string }) {
  const router = useRouter();
  const search = usePetSearch(query);
  return (
    <Results
      query={query}
      search={search}
      renderItem={(pet) => (
        <PetRow
          pet={pet}
          onPress={() => router.push({ pathname: '/pet/[id]', params: { id: pet.id } })}
        />
      )}
    />
  );
}

/** Results of the selected tab for `query` (already cleaned and debounced). */
export function SearchResults({ tab, query }: { tab: SearchTab; query: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { status } = useAuth();

  if (tab === 'users' && status !== 'signedIn') {
    return (
      <View style={styles.list}>
        <Message>{t('search.signInForUsers')}</Message>
        <Button
          variant="secondary"
          label={t('auth.signIn.title')}
          onPress={() => router.push('/sign-in')}
        />
      </View>
    );
  }
  if (!query) {
    return <Message>{t('search.prompt')}</Message>;
  }
  if (tab === 'users') return <UserResults query={query} />;
  if (tab === 'pets') return <PetResults query={query} />;
  return <PostGrid filter={{ text: query }} empty={t('search.noResults', { query })} />;
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  message: { textAlign: 'center', padding: spacing.lg },
});
