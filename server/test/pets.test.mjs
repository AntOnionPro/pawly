// End-to-end tests of pet profiles: who can create, see, edit and delete them, validation,
// and what happens when the owner deletes their account.
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

function createPet(token, body) {
  return pb.api(PETS, { method: 'POST', token, body });
}

describe('creating pets', () => {
  test('users register their own pets', async () => {
    const { record, token } = await verifiedUser();
    const { status, body } = await createPet(token, {
      owner: record.id,
      name: 'Luna',
      species: 'dog',
      breed: 'Xoloitzcuintle',
      birthDate: '2021-03-01 00:00:00.000Z',
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.name, 'Luna');
    assert.equal(body.owner, record.id);
    assert.ok(body.created);
  });

  test('visitors cannot create pets', async () => {
    const { record } = await verifiedUser();
    const { status } = await createPet(undefined, {
      owner: record.id,
      name: 'Luna',
      species: 'dog',
    });
    assert.equal(status, 400);
  });

  test('nobody can create a pet for someone else', async () => {
    const victim = await verifiedUser();
    const other = await verifiedUser();
    const { status } = await createPet(other.token, {
      owner: victim.record.id,
      name: 'Intruso',
      species: 'cat',
    });
    assert.equal(status, 400);
  });

  test('validates name, species and birth date', async () => {
    const { record, token } = await verifiedUser();
    const noName = await createPet(token, { owner: record.id, name: '', species: 'dog' });
    assert.ok(noName.body.data.name);
    const badSpecies = await createPet(token, { owner: record.id, name: 'X', species: 'dragon' });
    assert.ok(badSpecies.body.data.species);
    const longName = await createPet(token, {
      owner: record.id,
      name: 'x'.repeat(41),
      species: 'dog',
    });
    assert.ok(longName.body.data.name);
    const future = await createPet(token, {
      owner: record.id,
      name: 'Futuro',
      species: 'dog',
      birthDate: `${new Date().getUTCFullYear() + 1}-01-01 00:00:00.000Z`,
    });
    assert.equal(future.status, 400);
    assert.equal(future.body.data.birthDate.code, 'birthdate_future');
  });
});

describe('seeing pets', () => {
  test('anyone can see and list pets, filtered by owner', async () => {
    const { record, token } = await verifiedUser();
    await createPet(token, { owner: record.id, name: 'Michi', species: 'cat' });
    await createPet(token, { owner: record.id, name: 'Kiwi', species: 'bird' });
    const filter = encodeURIComponent(`owner = "${record.id}"`);
    const { status, body } = await pb.api(`${PETS}?filter=${filter}&sort=created`);
    assert.equal(status, 200);
    assert.deepEqual(
      body.items.map((pet) => pet.name),
      ['Michi', 'Kiwi'],
    );
  });
});

describe('editing and deleting pets', () => {
  test('owners edit their pets but cannot give them away', async () => {
    const owner = await verifiedUser();
    const other = await verifiedUser();
    const { body: pet } = await createPet(owner.token, {
      owner: owner.record.id,
      name: 'Toby',
      species: 'dog',
    });
    const renamed = await pb.api(`${PETS}/${pet.id}`, {
      method: 'PATCH',
      token: owner.token,
      body: { name: 'Toby Jr.' },
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.name, 'Toby Jr.');

    const givenAway = await pb.api(`${PETS}/${pet.id}`, {
      method: 'PATCH',
      token: owner.token,
      body: { owner: other.record.id },
    });
    assert.equal(givenAway.status, 404);

    const byOther = await pb.api(`${PETS}/${pet.id}`, {
      method: 'PATCH',
      token: other.token,
      body: { name: 'Mío' },
    });
    assert.equal(byOther.status, 404);
  });

  test('only the owner deletes a pet', async () => {
    const owner = await verifiedUser();
    const other = await verifiedUser();
    const { body: pet } = await createPet(owner.token, {
      owner: owner.record.id,
      name: 'Nube',
      species: 'rabbit',
    });
    const byOther = await pb.api(`${PETS}/${pet.id}`, { method: 'DELETE', token: other.token });
    assert.equal(byOther.status, 404);
    const byOwner = await pb.api(`${PETS}/${pet.id}`, { method: 'DELETE', token: owner.token });
    assert.equal(byOwner.status, 204);
  });

  test("deleting the account deletes the owner's pets", async () => {
    const { record, token } = await verifiedUser();
    const { body: pet } = await createPet(token, {
      owner: record.id,
      name: 'Coco',
      species: 'other',
    });
    const deleted = await pb.api(`${USERS}/records/${record.id}`, { method: 'DELETE', token });
    assert.equal(deleted.status, 204);
    assert.equal((await pb.api(`${PETS}/${pet.id}`)).status, 404);
  });
});
