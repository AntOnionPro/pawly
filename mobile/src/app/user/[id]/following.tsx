import { useLocalSearchParams } from 'expo-router';

import { FollowListView } from '@/features/follows/FollowListView';

export default function FollowingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FollowListView userId={id ?? ''} list="following" />;
}
