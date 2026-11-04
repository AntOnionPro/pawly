import type PocketBase from 'pocketbase';
import { ClientResponseError, type RecordModel } from 'pocketbase';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { getClient, restoreSession } from '@/api/client';

import { normalizeUsername, type SignUpValues } from './validation';

/** Public profile plus the owner's own email. */
export interface User {
  id: string;
  collectionId: string;
  username: string;
  email?: string;
  bio: string;
  avatar: string;
  verified: boolean;
}

export type AuthStatus = 'loading' | 'visitor' | 'signedIn';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  client: PocketBase;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (values: SignUpValues) => Promise<void>;
  signOut: () => void;
  requestVerification: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const USERS = 'users';

export function toUser(record: RecordModel | null | undefined): User | null {
  if (!record) return null;
  return {
    id: record.id,
    collectionId: record.collectionId,
    username: String(record.username ?? ''),
    email: typeof record.email === 'string' ? record.email : undefined,
    bio: String(record.bio ?? ''),
    avatar: String(record.avatar ?? ''),
    verified: Boolean(record.verified),
  };
}

interface AuthProviderProps extends PropsWithChildren {
  /** Injected in tests; the app uses the shared client. */
  client?: PocketBase;
}

export function AuthProvider({ children, client: injected }: AuthProviderProps) {
  const [client] = useState(() => injected ?? getClient());
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = client.authStore.onChange((_token, record) => {
      const next = client.authStore.isValid ? toUser(record) : null;
      setUser(next);
      setStatus(next ? 'signedIn' : 'visitor');
    });

    let active = true;
    void (async () => {
      await restoreSession(client);
      if (client.authStore.isValid) {
        try {
          // Fresh profile and token; fails if the account was deleted or is no longer verified.
          await client.collection(USERS).authRefresh();
        } catch (error) {
          if (error instanceof ClientResponseError && error.status !== 0) {
            client.authStore.clear();
          }
          // Offline (status 0): keep the saved session.
        }
      }
      if (active) {
        const restored = client.authStore.isValid ? toUser(client.authStore.record) : null;
        setUser(restored);
        setStatus(restored ? 'signedIn' : 'visitor');
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [client]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await client.collection(USERS).authWithPassword(email.trim(), password);
    },
    [client],
  );

  const signUp = useCallback(
    async (values: SignUpValues) => {
      await client.collection(USERS).create({
        username: normalizeUsername(values.username),
        email: values.email.trim(),
        password: values.password,
        passwordConfirm: values.passwordConfirm,
        // Sent as `dateOfBirth`: the server stores it in the hidden `birthdate` field.
        dateOfBirth: values.dateOfBirth,
        acceptTerms: values.acceptTerms,
      });
    },
    [client],
  );

  const signOut = useCallback(() => client.authStore.clear(), [client]);

  const requestVerification = useCallback(
    async (email: string) => {
      await client.collection(USERS).requestVerification(email.trim());
    },
    [client],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      await client.collection(USERS).requestPasswordReset(email.trim());
    },
    [client],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      client,
      signIn,
      signUp,
      signOut,
      requestVerification,
      requestPasswordReset,
    }),
    [status, user, client, signIn, signUp, signOut, requestVerification, requestPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
