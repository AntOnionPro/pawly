// Shared helpers for screen tests: providers with Spanish preferences and a fake session.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type PocketBase from 'pocketbase';
import { ClientResponseError } from 'pocketbase';
import type { ReactNode } from 'react';

import { AuthContext, type AuthContextValue, type User } from '@/auth/AuthProvider';
import { PreferencesProvider, usePreferences } from '@/preferences/PreferencesProvider';

export const TEST_USER: User = {
  id: 'u1',
  collectionId: '_pb_users_auth_',
  username: 'luna',
  email: 'luna@ejemplo.com',
  bio: 'Tengo una perrita.',
  avatar: '',
  verified: true,
  followerCount: 0,
  followingCount: 0,
};

/** Session whose actions are Jest mocks that succeed unless overridden. */
export function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: 'visitor',
    user: null,
    client: { files: { getURL: () => 'http://pawly.test/avatar.jpg' } } as unknown as PocketBase,
    signIn: jest.fn().mockResolvedValue(undefined),
    signUp: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn(),
    requestVerification: jest.fn().mockResolvedValue(undefined),
    requestPasswordReset: jest.fn().mockResolvedValue(undefined),
    updateProfile: jest.fn().mockResolvedValue(undefined),
    changePassword: jest.fn().mockResolvedValue(undefined),
    deleteAccount: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function signedIn(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return authValue({ status: 'signedIn', user: TEST_USER, ...overrides });
}

function ReadyGate({ children }: { children: ReactNode }) {
  return usePreferences().ready ? children : null;
}

/** Renders inside the preferences and the given session. Set the saved language before. */
export async function renderWith(ui: ReactNode, auth: AuthContextValue = authValue()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  return render(
    <PreferencesProvider>
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          <ReadyGate>{ui}</ReadyGate>
        </QueryClientProvider>
      </AuthContext.Provider>
    </PreferencesProvider>,
  );
}

export function serverError(status: number, data: Record<string, unknown> = {}) {
  return new ClientResponseError({ status, response: { status, message: 'x', data } });
}
