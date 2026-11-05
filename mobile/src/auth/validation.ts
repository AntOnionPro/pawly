import type { ErrorKey, FieldErrors } from '@/api/errors';

/** Same rules as the server (server/pb_migrations, server/pb_hooks/lib/accounts.js). */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const BIO_MAX_LENGTH = 150;
export const MINIMUM_AGE = 13;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface SignUpValues {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  /** "YYYY-MM-DD", or empty until chosen. */
  dateOfBirth: string;
  acceptTerms: boolean;
}

export const EMPTY_SIGN_UP: SignUpValues = {
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
  dateOfBirth: '',
  acceptTerms: false,
};

/** Usernames are lowercase; spaces around are ignored. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

/** Full years between `birth` and `today` (calendar dates, no time zone shifts). */
export function ageOn(birth: Date, today: Date): number {
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Parses "YYYY-MM-DD" as a local calendar date; `null` if it is not a real date. */
export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : null;
}

/** Formats a date as "YYYY-MM-DD" using its local calendar day. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function validateUsername(value: string): ErrorKey | null {
  const username = normalizeUsername(value);
  if (!username) return 'errors.required';
  return USERNAME_PATTERN.test(username) ? null : 'errors.usernameFormat';
}

export function validateEmail(value: string): ErrorKey | null {
  const email = value.trim();
  if (!email) return 'errors.required';
  return EMAIL_PATTERN.test(email) ? null : 'errors.emailInvalid';
}

export function validatePassword(value: string): ErrorKey | null {
  if (!value) return 'errors.required';
  return value.length >= PASSWORD_MIN_LENGTH ? null : 'errors.passwordTooShort';
}

export function validatePasswordConfirm(password: string, confirm: string): ErrorKey | null {
  if (!confirm) return 'errors.required';
  return password === confirm ? null : 'errors.passwordMismatch';
}

export function validateDateOfBirth(value: string, today: Date = new Date()): ErrorKey | null {
  if (!value) return 'errors.dateRequired';
  const birth = parseIsoDate(value);
  if (!birth || birth > today || birth.getFullYear() < 1900) return 'errors.dateInvalid';
  return ageOn(birth, today) >= MINIMUM_AGE ? null : 'errors.tooYoung';
}

function collect(entries: [string, ErrorKey | null][]): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, error] of entries) {
    if (error) errors[field] = error;
  }
  return errors;
}

export function validateSignUp(values: SignUpValues, today: Date = new Date()): FieldErrors {
  return collect([
    ['username', validateUsername(values.username)],
    ['email', validateEmail(values.email)],
    ['password', validatePassword(values.password)],
    ['passwordConfirm', validatePasswordConfirm(values.password, values.passwordConfirm)],
    ['dateOfBirth', validateDateOfBirth(values.dateOfBirth, today)],
    ['acceptTerms', values.acceptTerms ? null : 'errors.termsRequired'],
  ]);
}

export function validateSignIn(email: string, password: string): FieldErrors {
  return collect([
    ['email', validateEmail(email)],
    ['password', password ? null : 'errors.required'],
  ]);
}
