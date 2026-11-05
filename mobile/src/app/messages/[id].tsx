import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';
import { ChatView } from '@/features/messages/ChatView';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status } = useAuth();
  if (status !== 'signedIn') {
    return <Redirect href="/sign-in" />;
  }
  return <ChatView conversationId={id ?? ''} />;
}
