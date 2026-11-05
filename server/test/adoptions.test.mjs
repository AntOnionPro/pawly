// End-to-end tests of adoption listings: who can publish, see, edit and delete them, one
// available listing per pet, limits, filters, and what happens with the pet and the account.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { png, video } from './helpers/files.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser, superuserToken } = accountHelpers(() => pb);
const ADOPTIONS = '/api/collections/adoptions/records';
const PETS = '/api/collections/pets/records';
const MB = 1024 * 1024;

async function createPet(user, fields = {}) {
  const { status, body } = await pb.api(PETS, {
    method: 'POST',
    token: user.token,
    body: { owner: user.record.id, name: 'Luna', species: 'dog', ...fields },
  });
  assert.equal(status, 200, JSON.stringify(body));
  return body;
}

function listing(user, pet, fields = {}) {
  return {
    publisher: user.record.id,
    pet: pet.id,
    sex: 'female',
    size: 'medium',
    vaccines: 'complete',
    sterilized: true,
    health: 'Sana',
    zone: 'Coyoacán, CDMX',
    requirements: 'Casa con patio',
    description: 'Muy cariñosa',
    ...fields,
  };
}

function publish(token, body) {
  return pb.api(ADOPTIONS, { method: 'POST', token, body });
}

/** Sends a multipart request with fields and files ({ name, bytes, type }). */
async function upload(method, urlPath, token, fields = {}, files = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }
  for (const file of files) {
    form.append('media', new Blob([file.bytes], { type: file.type }), file.name);
  }
  const response = await fetch(`${pb.baseUrl}${urlPath}`, {
    method,
    headers: token ? { Authorization: token } : {},
    body: form,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const photo = (name = 'foto.png', bytes = png()) => ({ name, bytes, type: 'image/png' });

describe('publishing listings', () => {
  test('owners put their pets up for adoption, always as available', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const { status, body } = await publish(
      user.token,
      listing(user, pet, { status: 'adopted' }),
    );
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.status, 'available');
    assert.equal(body.pet, pet.id);
    assert.equal(body.zone, 'Coyoacán, CDMX');
    assert.equal(body.sterilized, true);
  });

  test('visitors cannot publish, nor in the name of someone else', async () => {
    const owner = await verifiedUser();
    const other = await verifiedUser();
    const pet = await createPet(owner);
    assert.equal((await publish(undefined, listing(owner, pet))).status, 400);
    assert.equal((await publish(other.token, listing(owner, pet))).status, 400);
  });

  test("nobody can put someone else's pet up for adoption", async () => {
    const owner = await verifiedUser();
    const other = await verifiedUser();
    const pet = await createPet(owner);
    const { status, body } = await publish(other.token, listing(other, pet));
    assert.equal(status, 400);
    assert.equal(body.data.pet.code, 'pet_not_owned');
  });

  test('a pet has one available listing at a time', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const { body: first } = await publish(user.token, listing(user, pet));
    const again = await publish(user.token, listing(user, pet));
    assert.equal(again.status, 400);
    assert.equal(again.body.data.pet.code, 'pet_already_listed');

    await pb.api(`${ADOPTIONS}/${first.id}`, { method: 'DELETE', token: user.token });
    assert.equal((await publish(user.token, listing(user, pet))).status, 200);
  });

  test('sex, size, vaccines and zone are required, and texts have limits', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const missing = await publish(user.token, {
      publisher: user.record.id,
      pet: pet.id,
      zone: ' ',
    });
    assert.equal(missing.status, 400);
    for (const field of ['sex', 'size', 'vaccines', 'zone']) {
      assert.ok(missing.body.data[field], `${field}: ${JSON.stringify(missing.body)}`);
    }
    const bad = await publish(user.token, listing(user, pet, { size: 'giant', sex: 'other' }));
    assert.ok(bad.body.data.size);
    assert.ok(bad.body.data.sex);
    const long = await publish(
      user.token,
      listing(user, pet, {
        zone: 'z'.repeat(81),
        health: 'h'.repeat(501),
        requirements: 'r'.repeat(1001),
        description: 'd'.repeat(2201),
      }),
    );
    for (const field of ['zone', 'health', 'requirements', 'description']) {
      assert.ok(long.body.data[field], field);
    }
  });

  test('up to 10 photos or videos, photos up to 10 MB', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const fields = listing(user, pet);
    const ok = await upload('POST', ADOPTIONS, user.token, fields, [
      photo(),
      { name: 'clip.mp4', bytes: video(), type: 'video/mp4' },
    ]);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.media.length, 2);

    const other = await createPet(user, { name: 'Sol' });
    const big = await upload('POST', ADOPTIONS, user.token, listing(user, other), [
      photo('grande.png', png(8, 11 * MB)),
    ]);
    assert.equal(big.status, 400);
    assert.equal(big.body.data.media.code, 'photo_too_large');

    const eleven = Array.from({ length: 11 }, (_, i) => photo(`f${i}.png`));
    const tooMany = await upload('POST', ADOPTIONS, user.token, listing(user, other), eleven);
    assert.equal(tooMany.status, 400);
    assert.ok(tooMany.body.data.media);
  });
});

describe('seeing listings', () => {
  test('anyone lists the available ones, filtered by species, size and sex', async () => {
    const user = await verifiedUser();
    const dog = await createPet(user, { name: 'Firulais', species: 'dog' });
    const cat = await createPet(user, { name: 'Michi', species: 'cat' });
    await publish(user.token, listing(user, dog, { size: 'large', sex: 'male' }));
    await publish(user.token, listing(user, cat, { size: 'small' }));

    const mine = `publisher = "${user.record.id}" && status = "available"`;
    const list = async (extra) => {
      const filter = encodeURIComponent(extra ? `${mine} && ${extra}` : mine);
      const { status, body } = await pb.api(`${ADOPTIONS}?filter=${filter}&sort=-created,-id`);
      assert.equal(status, 200, JSON.stringify(body));
      return body.items.map((item) => item.pet);
    };
    assert.deepEqual(await list(), [cat.id, dog.id]);
    assert.deepEqual(await list('pet.species = "dog"'), [dog.id]);
    assert.deepEqual(await list('size = "small"'), [cat.id]);
    assert.deepEqual(await list('sex = "male"'), [dog.id]);

    const { body } = await pb.api(
      `${ADOPTIONS}?filter=${encodeURIComponent(mine)}&sort=-created,-id&expand=pet,publisher`,
    );
    assert.equal(body.items[0].expand.pet.name, 'Michi');
    assert.ok(body.items[0].expand.publisher.username);
  });
});

describe('editing and deleting listings', () => {
  test('only the publisher edits, without changing the pet or the status', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    const pet = await createPet(user);
    const otherPet = await createPet(user, { name: 'Sol' });
    const { body: created } = await publish(user.token, listing(user, pet));
    const url = `${ADOPTIONS}/${created.id}`;

    const edited = await pb.api(url, {
      method: 'PATCH',
      token: user.token,
      body: { zone: '  Tlalpan, CDMX ', pet: otherPet.id, status: 'adopted' },
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.zone, 'Tlalpan, CDMX');
    assert.equal(edited.body.pet, pet.id);
    assert.equal(edited.body.status, 'available');

    const byOther = await pb.api(url, {
      method: 'PATCH',
      token: other.token,
      body: { zone: 'Otro lado' },
    });
    assert.equal(byOther.status, 404);
    const givenAway = await pb.api(url, {
      method: 'PATCH',
      token: user.token,
      body: { publisher: other.record.id },
    });
    assert.equal(givenAway.status, 404);
  });

  test('photos can be added and removed when editing', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const { body: created } = await upload('POST', ADOPTIONS, user.token, listing(user, pet), [
      photo('a.png'),
      photo('b.png'),
    ]);
    const [first] = created.media;
    const url = `${ADOPTIONS}/${created.id}`;
    const form = new FormData();
    form.append('media-', first);
    form.append('media+', new Blob([png()], { type: 'image/png' }), 'c.png');
    const response = await fetch(`${pb.baseUrl}${url}`, {
      method: 'PATCH',
      headers: { Authorization: user.token },
      body: form,
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.media.length, 2);
    assert.ok(!body.media.includes(first));
  });

  test('only the publisher deletes', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    const pet = await createPet(user);
    const { body: created } = await publish(user.token, listing(user, pet));
    const url = `${ADOPTIONS}/${created.id}`;
    assert.equal((await pb.api(url, { method: 'DELETE', token: other.token })).status, 404);
    assert.equal((await pb.api(url, { method: 'DELETE', token: user.token })).status, 204);
  });

  test('the admin panel can change the status', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const { body: created } = await publish(user.token, listing(user, pet));
    const { status, body } = await pb.api(`${ADOPTIONS}/${created.id}`, {
      method: 'PATCH',
      token: await superuserToken(),
      body: { status: 'adopted' },
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.status, 'adopted');
    // An adopted listing no longer blocks a new one for the same pet.
    assert.equal((await publish(user.token, listing(user, pet))).status, 200);
  });

  test('listings go away with the pet and with the account', async () => {
    const user = await verifiedUser();
    const pet = await createPet(user);
    const other = await createPet(user, { name: 'Sol' });
    const { body: byPet } = await publish(user.token, listing(user, pet));
    const { body: byAccount } = await publish(user.token, listing(user, other));

    await pb.api(`${PETS}/${pet.id}`, { method: 'DELETE', token: user.token });
    assert.equal((await pb.api(`${ADOPTIONS}/${byPet.id}`)).status, 404);

    await pb.api(`${USERS}/records/${user.record.id}`, { method: 'DELETE', token: user.token });
    assert.equal((await pb.api(`${ADOPTIONS}/${byAccount.id}`)).status, 404);
  });
});
