import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/auth/AuthProvider';

/**
 * Forgets what was loaded with the previous account when the account changes (signing in,
 * signing out or signing in with another account): paw prints, follows, reposts, requests and
 * counts belong to whoever was signed in. What is on screen loads again with the new account.
 */
export function useResetOnAccountChange(): void {
  const { status, user } = useAuth();
  const queryClient = useQueryClient();
  // undefined while the saved session is being read; null for visitors.
  const account = status === 'loading' ? undefined : (user?.id ?? null);
  const previous = useRef(account);
  useEffect(() => {
    if (account === undefined) return;
    const before = previous.current;
    previous.current = account;
    if (before !== undefined && before !== account) void queryClient.resetQueries();
  }, [account, queryClient]);
}
