import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { ConversationList } from '@/features/messages/ConversationList';

export default function MessagesScreen() {
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return <ConversationList />;
}
