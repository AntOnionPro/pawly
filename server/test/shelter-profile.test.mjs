// End-to-end tests of the profile of a shelter or rescuer: who can fill it in, what it holds
// and what happens to it when the verification is taken back.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;
let admin;

before(async () => {
  pb = await startPocketBase();
  admin = await superuserToken();
});

after(() => pb?.stop());

const { verifiedUser, superuserToken, newAccount, signUp } = accountHelpers(() => pb);
const REQUESTS = '/api/collections/verification_requests/records';

const PROFILE = {
  zone: 'Tlalpan, CDMX',
  latitude: 19.2869,
  longitude: -99.1672,
  hours: 'Lunes a sábado de 10 a 17 h',
  needs: ['food', 'blankets', 'volunteers'],
  needsNote: 'Croquetas para cachorro y cobijas.',
};

/** A user whose account Pawly verified as a rescuer, with the id of the approved request. */
async function verifiedRescuer() {
  const user = await verifiedUser();
  const { body: request } = await pb.api(REQUESTS, {
    method: 'POST',
    token: user.token,
    body: {
      user: user.record.id,
      kind: 'rescuer',
      publicName: 'Rescates Lupita',
      about: 'Rescato perros de la calle.',
    },
  });
  const approved = await pb.api(`${REQUESTS}/${request.id}`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'approved' },
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  return { ...user, requestId: request.id };
}

function save(user, body) {
  return pb.api(`${USERS}/records/${user.record.id}`, {
    method: 'PATCH',
    token: user.token,
    body,
  });
}

async function profile(user) {
  // Without a session: a profile is public.
  const { body } = await pb.api(`${USERS}/records/${user.record.id}`);
  return body;
}

describe('profile of a shelter or rescuer', () => {
  test('a verified account says where it is, when it attends and what it needs', async () => {
    const user = await verifiedRescuer();
    const { status, body } = await save(user, {
      ...PROFILE,
      zone: '  Tlalpan, CDMX ',
      hours: ' Lunes a sábado de 10 a 17 h ',
    });
    assert.equal(status, 200, JSON.stringify(body));

    const seen = await profile(user);
    assert.equal(seen.zone, 'Tlalpan, CDMX');
    assert.equal(seen.hours, 'Lunes a sábado de 10 a 17 h');
    assert.equal(seen.latitude, 19.2869);
    assert.equal(seen.longitude, -99.1672);
    assert.deepEqual(seen.needs, ['food', 'blankets', 'volunteers']);
    assert.equal(seen.needsNote, 'Croquetas para cachorro y cobijas.');
  });

  test('the map point is optional, and everything can be taken off again', async () => {
    const user = await verifiedRescuer();
    const noPoint = await save(user, { zone: 'Coyoacán', needs: ['foster'] });
    assert.equal(noPoint.status, 200, JSON.stringify(noPoint.body));
    assert.equal(noPoint.body.latitude, 0);
    assert.deepEqual(noPoint.body.needs, ['foster']);

    await save(user, PROFILE);
    const emptied = await save(user, {
      zone: '',
      latitude: 0,
      longitude: 0,
      hours: '',
      needs: [],
      needsNote: '',
    });
    assert.equal(emptied.status, 200, JSON.stringify(emptied.body));
    assert.equal(emptied.body.zone, '');
    assert.equal(emptied.body.longitude, 0);
    assert.deepEqual(emptied.body.needs, []);
    // The verification stays.
    assert.equal(emptied.body.accountKind, 'rescuer');
  });

  test('the app sends it as a form: several needs, and an empty one to take them all off', async () => {
    const user = await verifiedRescuer();
    const send = async (entries) => {
      const form = new FormData();
      for (const [key, value] of entries) form.append(key, value);
      const response = await fetch(`${pb.baseUrl}${USERS}/records/${user.record.id}`, {
        method: 'PATCH',
        headers: { Authorization: user.token },
        body: form,
      });
      return { status: response.status, body: await response.json() };
    };

    const saved = await send([
      ['zone', 'Tlalpan, CDMX'],
      ['latitude', '19.2869'],
      ['longitude', '-99.1672'],
      ['hours', '10 a 17 h'],
      ['needs', 'food'],
      ['needs', 'foster'],
      ['needsNote', 'Croquetas'],
    ]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.deepEqual(saved.body.needs, ['food', 'foster']);
    assert.equal(saved.body.latitude, 19.2869);

    const emptied = await send([
      ['zone', ''],
      ['latitude', '0'],
      ['longitude', '0'],
      ['hours', ''],
      ['needs', ''],
      ['needsNote', ''],
    ]);
    assert.equal(emptied.status, 200, JSON.stringify(emptied.body));
    assert.deepEqual(emptied.body.needs, []);
    assert.equal(emptied.body.latitude, 0);
    assert.equal(emptied.body.zone, '');
  });

  test('the point is whole, inside the map, and the needs are known ones', async () => {
    const user = await verifiedRescuer();
    const half = await save(user, { latitude: 19.28, longitude: 0 });
    assert.equal(half.body.data.latitude.code, 'location_required');
    const outside = await save(user, { latitude: 91, longitude: -99 });
    assert.ok(outside.body.data.latitude);
    const unknown = await save(user, { needs: ['money'] });
    assert.ok(unknown.body.data.needs);
    const long = await save(user, { zone: 'x'.repeat(121) });
    assert.ok(long.body.data.zone);
    const blocked = await save(user, { needsNote: 'Croquetas, pendejo' });
    assert.equal(blocked.body.data.needsNote.code, 'content_blocked');
  });

  test('a regular account has no such profile', async () => {
    const user = await verifiedUser();
    const { status, body } = await save(user, { ...PROFILE, bio: 'Hola' });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.bio, 'Hola');
    assert.equal(body.zone, '');
    assert.equal(body.latitude, 0);
    assert.equal(body.longitude, 0);
    assert.equal(body.hours, '');
    assert.deepEqual(body.needs, []);
    assert.equal(body.needsNote, '');

    const created = await signUp(newAccount(PROFILE));
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.zone, '');
    assert.deepEqual(created.body.needs, []);
  });

  test('taking the verification back empties the profile', async () => {
    const user = await verifiedRescuer();
    await save(user, PROFILE);
    const revoked = await pb.api(`${REQUESTS}/${user.requestId}`, {
      method: 'PATCH',
      token: admin,
      body: { status: 'revoked' },
    });
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));

    const seen = await profile(user);
    assert.equal(seen.accountKind, '');
    assert.equal(seen.zone, '');
    assert.equal(seen.latitude, 0);
    assert.equal(seen.longitude, 0);
    assert.equal(seen.hours, '');
    assert.deepEqual(seen.needs, []);
    assert.equal(seen.needsNote, '');
  });
});
