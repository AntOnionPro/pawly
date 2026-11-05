import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/auth/AuthProvider';
import { Screen } from '@/components/Screen';
import { TabBar } from '@/components/TabBar';
import { cleanQuery } from '@/features/search/api';
import { SearchField } from '@/features/search/SearchField';
import { SearchResults, type SearchTab } from '@/features/search/SearchResults';
import { useDebouncedValue } from '@/utils/useDebouncedValue';

/** How long typing must pause before searching. */
const SEARCH_DELAY_MS = 350;

export default function SearchScreen() {
  const { t } = useTranslation();
  const { status } = useAuth();
  const [text, setText] = useState('');
  const query = cleanQuery(useDebouncedValue(text, SEARCH_DELAY_MS));
  // Visitors cannot search users, so they start on pets.
  const [tab, setTab] = useState<SearchTab>(status === 'signedIn' ? 'users' : 'pets');

  return (
    <Screen edges={['bottom']}>
      <SearchField value={text} onChangeText={setText} />
      <TabBar
        tabs={[
          { value: 'users', label: t('search.tabs.users') },
          { value: 'pets', label: t('search.tabs.pets') },
          { value: 'posts', label: t('search.tabs.posts') },
        ]}
        selected={tab}
        onSelect={setTab}
      />
      <SearchResults tab={tab} query={query} />
    </Screen>
  );
}
