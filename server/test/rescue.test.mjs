// End-to-end tests of rescue reports: the three kinds and their fields, location, statuses,
// who can see, edit and delete them, limits, and what happens with the account.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { png } from './helpers/files.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

let pb;

before(async () => {
  pb = await startPocketBase();
});

after(() => pb?.stop());

const { verifiedUser } = accountHelpers(() => pb);
const REPORTS = '/api/collections/rescue_reports/records';
const PETS = '/api/collections/pets/records';
const MB = 1024 * 1024;
const DAY = 24 * 60 * 60 * 1000;
const serverDate = (date) => date.toISOString().replace('T', ' ');

function report(user, fields = {}) {
  return {
    reporter: user.record.id,
    kind: 'help',
    description: 'Perrito herido junto al mercado',
    latitude: 19.3467,
    longitude: -99.1617,
    place: 'Mercado de Coyoacán',
    urgency: 'high',
    ...fields,
  };
}

function create(user, body) {
  return pb.api(REPORTS, { method: 'POST', token: user?.token, body });
}

function patch(user, id, body) {
  return pb.api(`${REPORTS}/${id}`, { method: 'PATCH', token: user.token, body });
}

async function upload(user, fields, files) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  for (const file of files) {
    form.append('media', new Blob([file.bytes], { type: 'image/png' }), file.name);
  }
  const response = await fetch(`${pb.baseUrl}${REPORTS}`, {
    method: 'POST',
    headers: { Authorization: user.token },
    body: form,
  });
  return { status: response.status, body: await response.json() };
}

describe('reporting', () => {
  test('an animal that needs help, always open and with its urgency', async () => {
    const user = await verifiedUser();
    const { status, body } = await create(user, report(user, { status: 'closed' }));
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.kind, 'help');
    assert.equal(body.status, 'open');
    assert.equal(body.urgency, 'high');
    assert.equal(body.latitude, 19.3467);
    assert.equal(body.place, 'Mercado de Coyoacán');
  });

  test('a lost pet, with the pet and when it was last seen', async () => {
    const user = await verifiedUser();
    const { body: pet } = await pb.api(PETS, {
      method: 'POST',
      token: user.token,
      body: { owner: user.record.id, name: 'Luna', species: 'dog' },
    });
    const lastSeenAt = serverDate(new Date(Date.now() - DAY));
    const { status, body } = await create(
      user,
      report(user, { kind: 'lost', pet: pet.id, lastSeenAt, urgency: 'high' }),
    );
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.pet, pet.id);
    assert.ok(body.lastSeenAt);
    assert.equal(body.urgency, '');
  });

  test('a found animal drops the fields of the other kinds', async () => {
    const user = await verifiedUser();
    const { body } = await create(
      user,
      report(user, { kind: 'found', lastSeenAt: serverDate(new Date()) }),
    );
    assert.equal(body.kind, 'found');
    assert.equal(body.urgency, '');
    assert.equal(body.lastSeenAt, '');
  });

  test('each kind checks its own fields', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    const noUrgency = await create(user, report(user, { urgency: '' }));
    assert.equal(noUrgency.body.data.urgency.code, 'validation_required');

    const noDate = await create(user, report(user, { kind: 'lost' }));
    assert.equal(noDate.body.data.lastSeenAt.code, 'validation_required');
    const future = await create(
      user,
      report(user, { kind: 'lost', lastSeenAt: serverDate(new Date(Date.now() + 2 * DAY)) }),
    );
    // Today at noon UTC (what the app sends for "today") is fine at any hour and time zone.
    const today = `${new Date().toISOString().slice(0, 10)} 12:00:00.000Z`;
    const forToday = await create(user, report(user, { kind: 'lost', lastSeenAt: today }));
    assert.equal(forToday.status, 200, JSON.stringify(forToday.body));
    assert.equal(future.body.data.lastSeenAt.code, 'date_future');

    const { body: theirs } = await pb.api(PETS, {
      method: 'POST',
      token: other.token,
      body: { owner: other.record.id, name: 'Ajena', species: 'cat' },
    });
    const notMine = await create(
      user,
      report(user, { kind: 'lost', pet: theirs.id, lastSeenAt: serverDate(new Date()) }),
    );
    assert.equal(notMine.body.data.pet.code, 'pet_not_owned');
  });

  test('a location, a description and valid values are required', async () => {
    const user = await verifiedUser();
    const noPlace = await create(user, report(user, { latitude: 0, longitude: 0 }));
    assert.equal(noPlace.body.data.latitude.code, 'location_required');
    const outside = await create(user, report(user, { latitude: 91 }));
    assert.ok(outside.body.data.latitude);
    const empty = await create(user, report(user, { description: '   ' }));
    assert.ok(empty.body.data.description);
    const badKind = await create(user, report(user, { kind: 'adopt' }));
    assert.ok(badKind.body.data.kind);
    const longPlace = await create(user, report(user, { place: 'x'.repeat(121) }));
    assert.ok(longPlace.body.data.place);
  });

  test('photos up to 10 MB, at most 10 files', async () => {
    const user = await verifiedUser();
    const fields = report(user);
    const ok = await upload(user, fields, [{ name: 'a.png', bytes: png() }]);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.media.length, 1);
    const big = await upload(user, fields, [{ name: 'b.png', bytes: png(8, 11 * MB) }]);
    assert.equal(big.body.data.media.code, 'photo_too_large');
    const eleven = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.png`, bytes: png() }));
    assert.ok((await upload(user, fields, eleven)).body.data.media);
  });

  test('visitors cannot report, nor in the name of someone else', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    assert.equal((await create(undefined, report(user))).status, 400);
    assert.equal((await create(other, report(user))).status, 400);
  });
});

describe('seeing reports', () => {
  test('anyone lists the open ones, newest first, filtered by kind', async () => {
    const user = await verifiedUser();
    const { body: help } = await create(user, report(user));
    const { body: found } = await create(user, report(user, { kind: 'found' }));
    const { body: closed } = await create(user, report(user));
    await patch(user, closed.id, { status: 'closed' });

    const list = async (extra) => {
      const base = `reporter = "${user.record.id}" && status != 'closed'`;
      const filter = encodeURIComponent(extra ? `${base} && ${extra}` : base);
      const { status, body } = await pb.api(`${REPORTS}?filter=${filter}&sort=-created,-id`);
      assert.equal(status, 200);
      return body.items.map((item) => item.id);
    };
    assert.deepEqual(await list(), [found.id, help.id]);
    assert.deepEqual(await list('kind = "help"'), [help.id]);
  });
});

describe('changing reports', () => {
  test('the reporter edits and moves the status; the kind stays', async () => {
    const user = await verifiedUser();
    const { body: created } = await create(user, report(user));
    const edited = await patch(user, created.id, {
      description: 'Ya lo llevamos al veterinario',
      kind: 'found',
      status: 'in_progress',
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.body));
    assert.equal(edited.body.kind, 'help');
    assert.equal(edited.body.status, 'in_progress');
    assert.equal((await patch(user, created.id, { status: 'closed' })).body.status, 'closed');
  });

  test('only help reports can be in progress', async () => {
    const user = await verifiedUser();
    const { body: found } = await create(user, report(user, { kind: 'found' }));
    const bad = await patch(user, found.id, { status: 'in_progress' });
    assert.equal(bad.body.data.status.code, 'invalid_status');
    assert.equal((await patch(user, found.id, { status: 'closed' })).body.status, 'closed');
  });

  test('only the reporter edits or deletes, and nobody gives a report away', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    const { body: created } = await create(user, report(user));
    assert.equal((await patch(other, created.id, { status: 'closed' })).status, 404);
    assert.equal((await patch(user, created.id, { reporter: other.record.id })).status, 404);
    const url = `${REPORTS}/${created.id}`;
    assert.equal((await pb.api(url, { method: 'DELETE', token: other.token })).status, 404);
    assert.equal((await pb.api(url, { method: 'DELETE', token: user.token })).status, 204);
  });

  test('reports go away with the account', async () => {
    const user = await verifiedUser();
    const { body: created } = await create(user, report(user));
    await pb.api(`${USERS}/records/${user.record.id}`, { method: 'DELETE', token: user.token });
    assert.equal((await pb.api(`${REPORTS}/${created.id}`)).status, 404);
  });
});
