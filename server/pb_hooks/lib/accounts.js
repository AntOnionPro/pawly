// Shared account helpers, loaded from the hooks with require(). Plain JavaScript (no
// PocketBase globals) so the Node tests can also import it.

const MINIMUM_AGE = 13;

/** Full years between `birth` and `today`, in UTC. */
function ageOn(birth, today) {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Returns `null` when the birth date is valid and the person is at least 13,
 * or `{ code, message }` explaining why not.
 * `value` is the date as PocketBase stores it ("2010-05-31 00:00:00.000Z") or ISO 8601.
 */
function minimumAgeError(value, today) {
  const birth = value ? new Date(String(value).replace(' ', 'T')) : null;
  if (!birth || Number.isNaN(birth.getTime())) {
    return { code: 'birthdate_required', message: 'Enter your birth date.' };
  }
  if (birth > today || birth.getUTCFullYear() < 1900) {
    return { code: 'birthdate_invalid', message: 'Enter a valid birth date.' };
  }
  if (ageOn(birth, today) < MINIMUM_AGE) {
    return {
      code: 'too_young',
      message: `You must be at least ${MINIMUM_AGE} years old to use Pawly.`,
    };
  }
  return null;
}

/**
 * The suspension of a user record that is in force now: `{ until, forever, reason }`
 * (`until` as PocketBase stores dates, empty when it is for good), or `null`.
 */
function activeSuspension(record, now = new Date()) {
  if (!record) return null;
  const forever = record.getBool('suspendedForever');
  const until = record.getString('suspendedUntil');
  const end = until ? new Date(until.replace(' ', 'T')) : null;
  if (!forever && !(end && end > now)) return null;
  return {
    until: forever ? '' : until,
    forever,
    reason: record.getString('suspensionReason'),
  };
}

/**
 * Answers a request of a suspended account (403 `account_suspended`), saying until when and
 * why. The details go in `suspension`, next to the usual error fields.
 */
function suspendedResponse(e, suspension) {
  const message = 'This account is suspended.';
  return e.json(403, {
    status: 403,
    message,
    data: { account: { code: 'account_suspended', message } },
    suspension,
  });
}

/** The texts of a shelter's or rescuer's profile (plus `latitude`, `longitude` and `needs`). */
const SHELTER_TEXTS = ['zone', 'hours', 'needsNote'];

/** Empties the shelter or rescuer profile of a user record: a regular account has none. */
function clearShelterProfile(record) {
  for (const field of SHELTER_TEXTS) record.set(field, '');
  record.set('latitude', 0);
  record.set('longitude', 0);
  record.set('needs', []);
}

module.exports = {
  MINIMUM_AGE,
  ageOn,
  minimumAgeError,
  activeSuspension,
  suspendedResponse,
  SHELTER_TEXTS,
  clearShelterProfile,
};
