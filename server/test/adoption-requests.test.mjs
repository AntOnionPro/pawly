// End-to-end tests of adoption requests: sending, who sees them, the status changes each side
// can make, blocks, notifications, and what happens when the listing or an account goes away.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser, superuserToken } = accountHelpers(() => pb);
const ADOPTIONS = '/api/collections/adoptions/records';
const REQUESTS = '/api/collections/adoption_requests/records';
const NOTIFICATIONS = '/api/collections/notifications/records';

const create = (path, user, body) => pb.api(path, { method: 'POST', token: user?.token, body });

/** A user with a pet up for adoption. */
async function publisher() {
  const user = await verifiedUser();
  const { body: pet } = await create('/api/collections/pets/records', user, {
    owner: user.record.id,
    name: 'Firulais',
    species: 'dog',
  });
  const { status, body: adoption } = await create(ADOPTIONS, user, {
    publisher: user.record.id,
    pet: pet.id,
    sex: 'male',
    size: 'medium',
    vaccines: 'complete',
    zone: 'Coyoacán, CDMX',
  });
  assert.equal(status, 200, JSON.stringify(adoption));
  return { user, pet, adoption };
}

function request(applicant, adoption, message = 'Tengo patio y mucho tiempo.') {
  return create(REQUESTS, applicant, {
    adoption: adoption.id,
    applicant: applicant.record.id,
    message,
  });
}

function setStatus(user, id, status) {
  return pb.api(`${REQUESTS}/${id}`, { method: 'PATCH', token: user.token, body: { status } });
}

async function notifications(user) {
  const { body } = await pb.api(`${NOTIFICATIONS}?sort=-created,-id`, { token: user.token });
  return body.items;
}

describe('sending requests', () => {
  test('users ask to adopt with a message, and the publisher is notified', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const { status, body } = await create(REQUESTS, luna, {
      adoption: adoption.id,
      applicant: luna.record.id,
      message: '  Tengo patio.  ',
      status: 'accepted',
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.status, 'pending');
    assert.equal(body.message, 'Tengo patio.');

    const [notification] = await notifications(sol);
    assert.equal(notification.type, 'adoption_request');
    assert.equal(notification.actor, luna.record.id);
    assert.equal(notification.adoption, adoption.id);
  });

  test('a message is required and has a limit', async () => {
    const { adoption } = await publisher();
    const luna = await verifiedUser();
    assert.ok((await request(luna, adoption, '   ')).body.data.message);
    assert.ok((await request(luna, adoption, 'x'.repeat(1001))).body.data.message);
  });

  test('one request per person, never for your own listing, nor in the name of others', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    assert.equal((await request(luna, adoption)).status, 200);
    const again = await request(luna, adoption);
    assert.equal(again.status, 400);
    assert.equal(again.body.data.adoption.code, 'already_requested');

    const own = await request(sol, adoption);
    assert.equal(own.body.data.adoption.code, 'own_adoption');

    const forOther = await create(REQUESTS, rocco, {
      adoption: adoption.id,
      applicant: luna.record.id,
      message: 'Hola',
    });
    assert.equal(forOther.status, 400);
    const visitor = await pb.api(REQUESTS, {
      method: 'POST',
      body: { adoption: adoption.id, applicant: luna.record.id, message: 'Hola' },
    });
    assert.equal(visitor.status, 400);
  });

  test('nobody asks for a pet that is no longer available', async () => {
    const { adoption } = await publisher();
    await pb.api(`${ADOPTIONS}/${adoption.id}`, {
      method: 'PATCH',
      token: await superuserToken(),
      body: { status: 'adopted' },
    });
    const luna = await verifiedUser();
    const { status, body } = await request(luna, adoption);
    assert.equal(status, 400);
    assert.equal(body.data.adoption.code, 'adoption_closed');
  });

  test('nobody asks across a block, in either direction', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    await create('/api/collections/blocks/records', sol, {
      blocker: sol.record.id,
      blocked: luna.record.id,
    });
    await create('/api/collections/blocks/records', rocco, {
      blocker: rocco.record.id,
      blocked: sol.record.id,
    });
    assert.equal((await request(luna, adoption)).body.data.adoption.code, 'blocked');
    assert.equal((await request(rocco, adoption)).body.data.adoption.code, 'blocked');
  });
});

describe('seeing requests', () => {
  test('only the applicant and the publisher see a request', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const { body: sent } = await request(luna, adoption);
    const url = `${REQUESTS}/${sent.id}`;
    assert.equal((await pb.api(url, { token: luna.token })).status, 200);
    assert.equal((await pb.api(url, { token: sol.token })).status, 200);
    assert.equal((await pb.api(url, { token: rocco.token })).status, 404);
    assert.equal((await pb.api(url)).status, 404);

    const filter = encodeURIComponent(`adoption = "${adoption.id}"`);
    const { body } = await pb.api(`${REQUESTS}?filter=${filter}&expand=applicant`, {
      token: sol.token,
    });
    assert.deepEqual(
      body.items.map((item) => item.expand.applicant.username),
      [luna.record.username],
    );
    const { body: others } = await pb.api(`${REQUESTS}?filter=${filter}`, { token: rocco.token });
    assert.equal(others.items.length, 0);
  });
});

describe('answering requests', () => {
  test('the publisher accepts or rejects, and the applicant is notified', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const { body: sent } = await request(luna, adoption);

    const accepted = await setStatus(sol, sent.id, 'accepted');
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.status, 'accepted');
    let [notification] = await notifications(luna);
    assert.equal(notification.type, 'request_accepted');
    assert.equal(notification.actor, sol.record.id);
    assert.equal(notification.adoption, adoption.id);

    // The publisher can change their mind.
    assert.equal((await setStatus(sol, sent.id, 'rejected')).body.status, 'rejected');
    [notification] = await notifications(luna);
    assert.equal(notification.type, 'request_rejected');
  });

  test('the applicant withdraws, and cannot answer their own request', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const { body: sent } = await request(luna, adoption);

    const accept = await setStatus(luna, sent.id, 'accepted');
    assert.equal(accept.status, 400);
    assert.equal(accept.body.data.status.code, 'invalid_status');
    assert.equal((await setStatus(sol, sent.id, 'withdrawn')).status, 400);

    assert.equal((await setStatus(luna, sent.id, 'withdrawn')).body.status, 'withdrawn');
    // A withdrawn request stays withdrawn.
    assert.equal((await setStatus(sol, sent.id, 'accepted')).status, 400);
    assert.equal((await setStatus(luna, sent.id, 'pending')).status, 400);
  });

  test('editing changes only the status, and others cannot touch it', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const { body: sent } = await request(luna, adoption, 'Original');
    const url = `${REQUESTS}/${sent.id}`;
    const edited = await pb.api(url, {
      method: 'PATCH',
      token: luna.token,
      body: { message: 'Cambiado', applicant: rocco.record.id },
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.message, 'Original');
    assert.equal(edited.body.applicant, luna.record.id);
    assert.equal((await setStatus(rocco, sent.id, 'accepted')).status, 404);
    assert.equal((await pb.api(url, { method: 'DELETE', token: sol.token })).status, 403);
  });

  test('nothing changes once the pet is no longer available', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const { body: sent } = await request(luna, adoption);
    await pb.api(`${ADOPTIONS}/${adoption.id}`, {
      method: 'PATCH',
      token: await superuserToken(),
      body: { status: 'adopted' },
    });
    const late = await setStatus(sol, sent.id, 'accepted');
    assert.equal(late.status, 400);
    assert.equal(late.body.data.status.code, 'adoption_closed');
  });
});

describe('cleaning up', () => {
  test('requests and their notifications go away with the listing and the account', async () => {
    const { user: sol, adoption } = await publisher();
    const luna = await verifiedUser();
    const { body: sent } = await request(luna, adoption);
    await pb.api(`${ADOPTIONS}/${adoption.id}`, { method: 'DELETE', token: sol.token });
    assert.equal((await pb.api(`${REQUESTS}/${sent.id}`, { token: luna.token })).status, 404);
    assert.equal((await notifications(sol)).length, 0);

    const other = await publisher();
    const { body: second } = await request(luna, other.adoption);
    await pb.api(`${USERS}/records/${luna.record.id}`, { method: 'DELETE', token: luna.token });
    const seen = await pb.api(`${REQUESTS}/${second.id}`, { token: other.user.token });
    assert.equal(seen.status, 404);
  });
});
