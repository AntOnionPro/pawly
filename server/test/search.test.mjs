// End-to-end tests of the filters the app uses to search: they ignore upper and lower case,
// and visitors cannot list users.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser } = accountHelpers(() => pb);
const PETS = '/api/collections/pets/records';
const POSTS = '/api/collections/posts/records';

function search(path, filter, token) {
  return pb.api(`${path}?filter=${encodeURIComponent(filter)}`, { token });
}

describe('search filters', () => {
  test('users by username, only with a session', async () => {
    const sol = await verifiedUser({ username: `sol.busca.${process.pid}` });
    const filter = `username ~ "SOL.BUSCA"`;
    const signedIn = await search(`${USERS}/records`, filter, sol.token);
    assert.equal(signedIn.status, 200);
    assert.deepEqual(
      signedIn.body.items.map((user) => user.username),
      [sol.record.username],
    );
    const visitor = await search(`${USERS}/records`, filter);
    assert.equal(visitor.status, 200);
    assert.deepEqual(visitor.body.items, []);
  });

  test('pets by name or breed, for anyone', async () => {
    const owner = await verifiedUser();
    for (const [name, breed] of [
      ['Firulais', 'Labrador'],
      ['Michi', 'Siamés'],
    ]) {
      await pb.api(PETS, {
        method: 'POST',
        token: owner.token,
        body: { owner: owner.record.id, name, species: 'dog', breed },
      });
    }
    const byBreed = await search(PETS, 'name ~ "labra" || breed ~ "labra"');
    assert.deepEqual(
      byBreed.body.items.map((pet) => pet.name),
      ['Firulais'],
    );
    const byName = await search(PETS, 'name ~ "MICH" || breed ~ "MICH"');
    assert.deepEqual(
      byName.body.items.map((pet) => pet.name),
      ['Michi'],
    );
  });

  test('posts by text, without reposts', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: original } = await pb.api(POSTS, {
      method: 'POST',
      token: sol.token,
      body: { author: sol.record.id, text: 'Paseo en la PLAYA' },
    });
    await pb.api(POSTS, {
      method: 'POST',
      token: luna.token,
      body: { author: luna.record.id, repostOf: original.id, text: 'Qué linda playa' },
    });
    const { body } = await search(POSTS, `text ~ "playa" && repostOf = ''`);
    assert.deepEqual(
      body.items.map((post) => post.id),
      [original.id],
    );
  });
});
