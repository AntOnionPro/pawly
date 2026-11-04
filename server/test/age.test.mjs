// Unit tests for the minimum age rule used by the sign-up hook.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { ageOn, minimumAgeError, MINIMUM_AGE } = require('../pb_hooks/lib/accounts.js');

const today = new Date('2026-11-04T12:00:00Z');

test('the minimum age is 13', () => {
  assert.equal(MINIMUM_AGE, 13);
});

test('ageOn counts full years', () => {
  assert.equal(ageOn(new Date('2013-11-04T00:00:00Z'), today), 13);
  assert.equal(ageOn(new Date('2013-11-05T00:00:00Z'), today), 12);
  assert.equal(ageOn(new Date('2013-12-01T00:00:00Z'), today), 12);
  assert.equal(ageOn(new Date('2000-02-29T00:00:00Z'), today), 26);
});

test('accepts people who are 13 or older, in PocketBase and ISO formats', () => {
  assert.equal(minimumAgeError('2013-11-04 00:00:00.000Z', today), null);
  assert.equal(minimumAgeError('1990-06-15T00:00:00Z', today), null);
});

test('rejects people younger than 13', () => {
  assert.equal(minimumAgeError('2013-11-05 00:00:00.000Z', today).code, 'too_young');
  assert.equal(minimumAgeError('2020-01-01', today).code, 'too_young');
});

test('rejects missing, impossible and future dates', () => {
  assert.equal(minimumAgeError('', today).code, 'birthdate_required');
  assert.equal(minimumAgeError(null, today).code, 'birthdate_required');
  assert.equal(minimumAgeError('not a date', today).code, 'birthdate_required');
  assert.equal(minimumAgeError('2030-01-01', today).code, 'birthdate_invalid');
  assert.equal(minimumAgeError('1850-01-01', today).code, 'birthdate_invalid');
});
