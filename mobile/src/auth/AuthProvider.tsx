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
import type { PickedImage } from '@/utils/pickPhoto';
import { appendFile } from '@/utils/upload';

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
  updateProfile: (changes: ProfileChanges) => Promise<void>;
  changePassword: (oldPassword: string, password: string, passwordConfirm: string) => Promise<void>;
  /** Checks the password again, deletes the account and signs out. */
  deleteAccount: (password: string) => Promise<void>;
}

export interface ProfileChanges {
  username?: string;
  bio?: string;
  /** New photo, `null` to remove it, or leave out to keep it. */
  avatar?: PickedImage | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const USERS = 'users';

/** URL of a profile photo (a 400×400 thumbnail by default), or null if there is none. */
export function avatarUrl(client: PocketBase, user: User, thumb = '400x400'): string | null {
  if (!user.avatar) return null;
  return client.files.getURL(
    { id: user.id, collectionId: user.collectionId, collectionName: USERS },
    user.avatar,
    { thumb },
  );
}

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

  const updateProfile = useCallback(
    async ({ username, bio, avatar }: ProfileChanges) => {
      const id = client.authStore.record?.id;
      if (!id) throw new Error('Not signed in');
      const data = new FormData();
      if (username !== undefined) data.append('username', normalizeUsername(username));
      if (bio !== undefined) data.append('bio', bio.trim());
      if (avatar === null) {
        data.append('avatar', '');
      } else if (avatar) {
        await appendFile(data, 'avatar', avatar);
      }
      // The SDK updates the saved session with the new profile.
      await client.collection(USERS).update(id, data);
    },
    [client],
  );

  const changePassword = useCallback(
    async (oldPassword: string, password: string, passwordConfirm: string) => {
      const record = client.authStore.record;
      if (!record) throw new Error('Not signed in');
      await client.collection(USERS).update(record.id, { oldPassword, password, passwordConfirm });
      // Changing the password invalidates every session: sign in again with the new one.
      await client.collection(USERS).authWithPassword(String(record.email), password);
    },
    [client],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      const record = client.authStore.record;
      if (!record) throw new Error('Not signed in');
      // Re-authenticate so a borrowed, unlocked phone cannot delete the account.
      await client.collection(USERS).authWithPassword(String(record.email), password);
      await client.collection(USERS).delete(record.id);
      client.authStore.clear();
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
      updateProfile,
      changePassword,
      deleteAccount,
    }),
    [
      status,
      user,
      client,
      signIn,
      signUp,
      signOut,
      requestVerification,
      requestPasswordReset,
      updateProfile,
      changePassword,
      deleteAccount,
    ],
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
