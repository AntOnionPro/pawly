import { useTranslation } from 'react-i18next';

import { TabBar } from '@/components/TabBar';

export type FeedTab = 'following' | 'discover';

/** "Following" and "Discover" tabs at the top of the home feed. */
export function FeedTabs({
  selected,
  onSelect,
}: {
  selected: FeedTab;
  onSelect: (tab: FeedTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <TabBar
      tabs={[
        { value: 'following', label: t('feed.tabs.following') },
        { value: 'discover', label: t('feed.tabs.discover') },
      ]}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
