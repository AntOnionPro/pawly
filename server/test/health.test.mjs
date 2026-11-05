// Checks that PocketBase starts with the repository's migrations and hooks.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

test('PocketBase answers its built-in health check', async () => {
  const { status } = await pb.api('/api/health');
  assert.equal(status, 200);
});

test('the Pawly health route from pb_hooks responds', async () => {
  const { status, body } = await pb.api('/api/pawly/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

test('the migrations ran: the app is named Pawly', async () => {
  const { body } = await pb.api('/api/pawly/health');
  assert.equal(body.app, 'Pawly');
});

test('unknown routes return 404', async () => {
  const { status } = await pb.api('/api/pawly/does-not-exist');
  assert.equal(status, 404);
});
