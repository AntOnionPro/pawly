import { ClientResponseError } from 'pocketbase';

/** Translation keys for form and request errors (see `errors` in the locales). */
export type ErrorKey =
  | 'errors.required'
  | 'errors.usernameFormat'
  | 'errors.usernameTaken'
  | 'errors.emailInvalid'
  | 'errors.emailTaken'
  | 'errors.passwordTooShort'
  | 'errors.passwordMismatch'
  | 'errors.passwordWrong'
  | 'errors.dateRequired'
  | 'errors.dateInvalid'
  | 'errors.tooYoung'
  | 'errors.termsRequired'
  | 'errors.tooLong'
  | 'errors.invalid'
  | 'errors.invalidCredentials'
  | 'errors.unverified'
  | 'errors.network'
  | 'errors.generic'
  | 'errors.postEmpty'
  | 'errors.photoTooLarge'
  | 'errors.videoTooLarge'
  | 'errors.videoTooLong'
  | 'errors.tooManyFiles'
  | 'errors.fileType'
  | 'errors.fileTooLarge'
  | 'errors.petNotOwned'
  | 'errors.petAlreadyListed'
  | 'errors.alreadyRequested'
  | 'errors.ownAdoption'
  | 'errors.adoptionClosed'
  | 'errors.requestNotAccepted'
  | 'errors.followupNotOverdue'
  | 'errors.locationRequired'
  | 'errors.alreadyHelping'
  | 'errors.ownReport'
  | 'errors.reportClosed'
  | 'errors.alreadyReposted'
  | 'errors.alreadyReported'
  | 'errors.blocked'
  | 'errors.suspended';

export type FieldErrors = Partial<Record<string, ErrorKey>>;

/** What went wrong with a request, for the message shown above a form. */
export type RequestErrorKind =
  'network' | 'invalidCredentials' | 'unverified' | 'suspended' | 'validation' | 'unknown';

/** Whether the server refused the request because the account is suspended. */
export function isSuspendedError(error: unknown): boolean {
  if (!(error instanceof ClientResponseError) || error.status !== 403) return false;
  const data = (error.response?.data ?? {}) as { account?: { code?: string } };
  return data.account?.code === 'account_suspended';
}

function codeToKey(field: string, code: string): ErrorKey {
  switch (code) {
    case 'validation_required':
      return field === 'dateOfBirth' ? 'errors.dateRequired' : 'errors.required';
    case 'validation_not_unique':
      if (field === 'username') return 'errors.usernameTaken';
      if (field === 'email') return 'errors.emailTaken';
      if (field === 'repostOf') return 'errors.alreadyReposted';
      return 'errors.invalid';
    case 'validation_is_email':
    case 'validation_invalid_email':
      return 'errors.emailInvalid';
    case 'validation_values_mismatch':
      return 'errors.passwordMismatch';
    case 'validation_invalid_old_password':
      return 'errors.passwordWrong';
    case 'validation_min_text_constraint':
    case 'validation_length_out_of_range':
    case 'validation_invalid_format':
    case 'validation_match_invalid':
      if (field === 'username') return 'errors.usernameFormat';
      if (field === 'password') return 'errors.passwordTooShort';
      return 'errors.invalid';
    case 'validation_max_text_constraint':
      return 'errors.tooLong';
    case 'birthdate_required':
      return 'errors.dateRequired';
    case 'birthdate_invalid':
    case 'birthdate_future':
      return 'errors.dateInvalid';
    case 'too_young':
      return 'errors.tooYoung';
    case 'terms_required':
      return 'errors.termsRequired';
    case 'post_empty':
      return 'errors.postEmpty';
    case 'photo_too_large':
      return 'errors.photoTooLarge';
    case 'pet_not_owned':
      return 'errors.petNotOwned';
    case 'pet_already_listed':
      return 'errors.petAlreadyListed';
    case 'already_requested':
      return 'errors.alreadyRequested';
    case 'own_adoption':
      return 'errors.ownAdoption';
    case 'adoption_closed':
      return 'errors.adoptionClosed';
    case 'request_not_accepted':
      return 'errors.requestNotAccepted';
    case 'followup_not_overdue':
      return 'errors.followupNotOverdue';
    case 'location_required':
      return 'errors.locationRequired';
    case 'already_helping':
      return 'errors.alreadyHelping';
    case 'own_report':
      return 'errors.ownReport';
    case 'report_closed':
      return 'errors.reportClosed';
    case 'date_future':
      return 'errors.dateInvalid';
    case 'blocked':
      return 'errors.blocked';
    case 'validation_too_many_files':
      return 'errors.tooManyFiles';
    case 'validation_invalid_mime_type':
      return 'errors.fileType';
    case 'validation_file_size_limit':
      return 'errors.fileTooLarge';
    default:
      return 'errors.invalid';
  }
}

/** Field errors returned by PocketBase (`{ data: { field: { code } } }`), as translation keys. */
export function toFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) {
    return {};
  }
  const data = (error.response?.data ?? {}) as Record<string, { code?: string } | undefined>;
  const result: FieldErrors = {};
  for (const [field, detail] of Object.entries(data)) {
    if (detail?.code && detail.code !== 'account_suspended') {
      result[field] = codeToKey(field, detail.code);
    }
  }
  return result;
}

export function requestErrorKind(error: unknown): RequestErrorKind {
  if (!(error instanceof ClientResponseError)) {
    return 'unknown';
  }
  // status 0: the request never reached the server (offline, wrong address, server down).
  if (error.status === 0) return 'network';
  if (isSuspendedError(error)) return 'suspended';
  if (Object.keys(toFieldErrors(error)).length > 0) return 'validation';
  if (error.status === 403) return 'unverified';
  if (error.status === 400) return 'invalidCredentials';
  return 'unknown';
}

/** Message for errors that are not tied to a field. */
export function requestErrorKey(kind: RequestErrorKind): ErrorKey | null {
  switch (kind) {
    case 'network':
      return 'errors.network';
    case 'invalidCredentials':
      return 'errors.invalidCredentials';
    case 'unverified':
      return 'errors.unverified';
    case 'suspended':
      return 'errors.suspended';
    case 'unknown':
      return 'errors.generic';
    default:
      return null;
  }
}
