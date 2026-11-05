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

module.exports = { MINIMUM_AGE, ageOn, minimumAgeError };
