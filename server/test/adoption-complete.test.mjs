// End-to-end tests of completing an adoption: the listing records the adopter, the pet moves
// to its new family, the other requests are closed, and the pet's history stays intact.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser } = accountHelpers(() => pb);
const ADOPTIONS = '/api/collections/adoptions/records';
const REQUESTS = '/api/collections/adoption_requests/records';
const PETS = '/api/collections/pets/records';
const POSTS = '/api/collections/posts/records';
const NOTIFICATIONS = '/api/collections/notifications/records';

const create = (path, user, body) => pb.api(path, { method: 'POST', token: user.token, body });
const patch = (path, user, body) => pb.api(path, { method: 'PATCH', token: user.token, body });

/** A publisher with a pet up for adoption, a post that tags it, and an accepted request. */
async function scenario() {
  const sol = await verifiedUser();
  const luna = await verifiedUser();
  const { body: pet } = await create(PETS, sol, {
    owner: sol.record.id,
    name: 'Michi',
    species: 'cat',
  });
  const { body: post } = await create(POSTS, sol, {
    author: sol.record.id,
    text: 'Michi en su primer día',
    pets: [pet.id],
  });
  const { body: adoption } = await create(ADOPTIONS, sol, {
    publisher: sol.record.id,
    pet: pet.id,
    sex: 'female',
    size: 'small',
    vaccines: 'complete',
    zone: 'Tlalpan, CDMX',
  });
  const request = await ask(luna, adoption);
  await patch(`${REQUESTS}/${request.id}`, sol, { status: 'accepted' });
  return { sol, luna, pet, post, adoption, request };
}

async function ask(user, adoption) {
  const { status, body } = await create(REQUESTS, user, {
    adoption: adoption.id,
    applicant: user.record.id,
    message: 'Me encantaría adoptarla.',
  });
  assert.equal(status, 200, JSON.stringify(body));
  return body;
}

function adopt(user, adoption, request) {
  return pb.api(`/api/pawly/adoptions/${adoption.id}/adopt`, {
    method: 'POST',
    token: user?.token,
    body: { request: request?.id ?? '' },
  });
}

async function notifications(user) {
  const { body } = await pb.api(`${NOTIFICATIONS}?sort=-created,-id`, { token: user.token });
  return body.items;
}

describe('marking a pet as adopted', () => {
  test('the listing closes and the pet moves to its new family', async () => {
    const { sol, luna, pet, adoption, request } = await scenario();
    const { status, body } = await adopt(sol, adoption, request);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.status, 'adopted');
    assert.equal(body.adopter, luna.record.id);
    assert.ok(body.adoptedAt);

    const { body: moved } = await pb.api(`${PETS}/${pet.id}`);
    assert.equal(moved.owner, luna.record.id);
    assert.equal(moved.previousOwner, sol.record.id);
    assert.ok(moved.adoptedAt);

    const [congrats] = await notifications(luna);
    assert.equal(congrats.type, 'adopted');
    assert.equal(congrats.actor, sol.record.id);
    assert.equal(congrats.adoption, adoption.id);

    const filter = encodeURIComponent(`id = "${adoption.id}" && status = 'available'`);
    assert.equal((await pb.api(`${ADOPTIONS}?filter=${filter}`)).body.items.length, 0);
  });

  test('the other open requests are rejected and their applicants told', async () => {
    const { sol, adoption, request } = await scenario();
    const waiting = await verifiedUser();
    const alsoAccepted = await verifiedUser();
    const gaveUp = await verifiedUser();
    const pending = await ask(waiting, adoption);
    const accepted = await ask(alsoAccepted, adoption);
    await patch(`${REQUESTS}/${accepted.id}`, sol, { status: 'accepted' });
    const withdrawn = await ask(gaveUp, adoption);
    await patch(`${REQUESTS}/${withdrawn.id}`, gaveUp, { status: 'withdrawn' });

    assert.equal((await adopt(sol, adoption, request)).status, 200);
    const status = async (id) => (await pb.api(`${REQUESTS}/${id}`, { token: sol.token })).body;
    assert.equal((await status(request.id)).status, 'accepted');
    assert.equal((await status(pending.id)).status, 'rejected');
    assert.equal((await status(accepted.id)).status, 'rejected');
    assert.equal((await status(withdrawn.id)).status, 'withdrawn');

    assert.equal((await notifications(waiting))[0].type, 'request_rejected');
    assert.equal((await notifications(gaveUp)).length, 0);
  });

  test('only the publisher, only once, and only with an accepted request', async () => {
    const { sol, luna, adoption, request } = await scenario();
    const other = await scenario();
    const pending = await ask(await verifiedUser(), adoption);

    assert.equal((await adopt(luna, adoption, request)).status, 403);
    assert.equal((await adopt(undefined, adoption, request)).status, 401);
    const notAccepted = await adopt(sol, adoption, pending);
    assert.equal(notAccepted.status, 400);
    assert.equal(notAccepted.body.data.request.code, 'request_not_accepted');
    const elsewhere = await adopt(sol, adoption, other.request);
    assert.equal(elsewhere.body.data.request.code, 'request_not_accepted');
    assert.equal((await adopt(sol, { id: 'noexiste123' }, request)).status, 404);

    assert.equal((await adopt(sol, adoption, request)).status, 200);
    const again = await adopt(sol, adoption, request);
    assert.equal(again.status, 400);
    assert.equal(again.body.data.adoption.code, 'adoption_closed');
  });

  test('an adopted listing can no longer be edited, deleted or requested', async () => {
    const { sol, adoption, request } = await scenario();
    await adopt(sol, adoption, request);
    const url = `${ADOPTIONS}/${adoption.id}`;
    const edited = await patch(url, sol, { zone: 'Otra' });
    assert.equal(edited.status, 400);
    assert.equal(edited.body.data.status.code, 'adoption_closed');
    assert.equal((await pb.api(url, { method: 'DELETE', token: sol.token })).status, 404);
    const late = await create(REQUESTS, await verifiedUser(), {
      adoption: adoption.id,
      message: 'Hola',
    });
    assert.equal(late.status, 400);
  });

  test('nobody sets the adoption data of a listing or a pet by hand', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const { body: pet } = await create(PETS, sol, {
      owner: sol.record.id,
      name: 'Kiwi',
      species: 'bird',
      previousOwner: luna.record.id,
      adoptedAt: '2026-01-01 00:00:00.000Z',
    });
    assert.equal(pet.previousOwner, '');
    assert.equal(pet.adoptedAt, '');
    const edited = await patch(`${PETS}/${pet.id}`, sol, { previousOwner: luna.record.id });
    assert.equal(edited.body.previousOwner, '');

    const { body: adoption } = await create(ADOPTIONS, sol, {
      publisher: sol.record.id,
      pet: pet.id,
      sex: 'male',
      size: 'small',
      vaccines: 'none',
      zone: 'Centro',
      adopter: luna.record.id,
    });
    assert.equal(adoption.adopter, '');
    const changed = await patch(`${ADOPTIONS}/${adoption.id}`, sol, { adopter: luna.record.id });
    assert.equal(changed.body.adopter, '');
  });
});

describe("the pet's new family", () => {
  test('the new owner edits the pet and tags it; the old owner no longer can', async () => {
    const { sol, luna, pet, adoption, request } = await scenario();
    await adopt(sol, adoption, request);

    assert.equal((await patch(`${PETS}/${pet.id}`, luna, { name: 'Michi Luna' })).status, 200);
    assert.equal((await patch(`${PETS}/${pet.id}`, sol, { name: 'Mía' })).status, 404);
    const tagged = await create(POSTS, luna, {
      author: luna.record.id,
      text: 'Ya en casa',
      pets: [pet.id],
    });
    assert.equal(tagged.status, 200, JSON.stringify(tagged.body));
    const byOld = await create(POSTS, sol, {
      author: sol.record.id,
      text: 'La extraño',
      pets: [pet.id],
    });
    assert.equal(byOld.body.data.pets.code, 'pet_not_owned');
  });

  test('earlier posts keep their author and the tag, and can still be edited', async () => {
    const { sol, luna, pet, post, adoption, request } = await scenario();
    await adopt(sol, adoption, request);

    const { body: kept } = await pb.api(`${POSTS}/${post.id}`);
    assert.equal(kept.author, sol.record.id);
    assert.deepEqual(kept.pets, [pet.id]);
    const edited = await patch(`${POSTS}/${post.id}`, sol, {
      text: 'Michi en su primer día (ya adoptada)',
      pets: [pet.id],
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.deepEqual(edited.body.pets, [pet.id]);

    const byPet = encodeURIComponent(`pets ~ "${pet.id}"`);
    const { body } = await pb.api(`${POSTS}?filter=${byPet}`);
    assert.deepEqual(
      body.items.map((item) => item.author),
      [sol.record.id],
    );
    assert.ok(luna.record.id);
  });
});
