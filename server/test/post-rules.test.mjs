// Unit tests for the post rules used by pb_hooks/posts.pb.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { isPhoto, postError, MAX_PHOTO_SIZE } = require('../pb_hooks/lib/posts.js');

const base = { text: 'Hola', mediaCount: 0, newFiles: [], author: 'u1', petOwners: [] };

test('a post with text or media is valid', () => {
  assert.equal(postError(base), null);
  assert.equal(postError({ ...base, text: '', mediaCount: 1 }), null);
});

test('an empty post is rejected', () => {
  assert.equal(postError({ ...base, text: '   ' }).code, 'post_empty');
});

test('photos are limited to 10 MB, videos are not limited here', () => {
  const big = MAX_PHOTO_SIZE + 1;
  assert.equal(
    postError({ ...base, mediaCount: 1, newFiles: [{ name: 'a.JPG', size: big }] }).code,
    'photo_too_large',
  );
  assert.equal(
    postError({ ...base, mediaCount: 1, newFiles: [{ name: 'a.mp4', size: big * 3 }] }),
    null,
  );
});

test('only the author pets can be tagged', () => {
  assert.equal(postError({ ...base, petOwners: ['u1', 'u1'] }), null);
  assert.equal(postError({ ...base, petOwners: ['u1', 'u2'] }).code, 'pet_not_owned');
  assert.equal(postError({ ...base, petOwners: [''] }).code, 'pet_not_owned');
});

test('recognizes photo extensions', () => {
  for (const name of ['a.jpg', 'b.JPEG', 'c.png', 'd.webp', 'e.heic']) assert.ok(isPhoto(name));
  for (const name of ['a.mp4', 'b.mov', 'c']) assert.ok(!isPhoto(name));
});
