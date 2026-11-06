import type { TFunction } from 'i18next';
import { ClientResponseError } from 'pocketbase';

import { isSuspendedError } from '@/api/errors';

/** Until when (empty when it is for good) and why an account is suspended. */
export interface Suspension {
  until: string;
  forever: boolean;
  reason: string;
}

/** The suspension the server describes in a 403 `account_suspended` answer, or `null`. */
export function suspensionFromBody(body: unknown): Suspension | null {
  const value = (body ?? {}) as {
    data?: { account?: { code?: string } };
    suspension?: Partial<Suspension>;
  };
  if (value.data?.account?.code !== 'account_suspended') return null;
  return {
    until: String(value.suspension?.until ?? ''),
    forever: Boolean(value.suspension?.forever),
    reason: String(value.suspension?.reason ?? ''),
  };
}

/** The suspension behind a failed request, or `null` when it failed for another reason. */
export function suspensionOf(error: unknown): Suspension | null {
  if (!isSuspendedError(error) || !(error instanceof ClientResponseError)) return null;
  return suspensionFromBody(error.response);
}

/** "Your account is suspended until November 12, 2026, 10:00 AM. Reason: Spam" */
export function suspensionText(t: TFunction, language: string, suspension: Suspension): string {
  const end = new Date(suspension.until.replace(' ', 'T'));
  const first =
    suspension.forever || Number.isNaN(end.getTime())
      ? t('auth.suspended.forever')
      : t('auth.suspended.until', {
          date: end.toLocaleString(language, { dateStyle: 'long', timeStyle: 'short' }),
        });
  return suspension.reason
    ? `${first} ${t('auth.suspended.reason', { reason: suspension.reason })}`
    : first;
}
