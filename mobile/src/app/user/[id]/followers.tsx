import { useLocalSearchParams } from 'expo-router';

import { FollowListView } from '@/features/follows/FollowListView';

export default function FollowersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowListView userId={id ?? ''} list="followers" />;
}
