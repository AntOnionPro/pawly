// Tests of nearby rescue alerts: the distance helpers, saving an approximate location, and who
// is alerted (and how) when a report is created.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { after, before, beforeEach, describe, test } from 'node:test';

import { accountHelpers } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

const require = createRequire(import.meta.url);
const { distanceKm, formatKm, roundCoordinate } = require('../pb_hooks/lib/geo.js');

let pb;
let expo;
let received = [];

before(async () => {
  expo = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      const messages = JSON.parse(body);
      received.push(...messages);
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ data: messages.map(() => ({ status: 'ok' })) }));
    });
  });
  await new Promise((resolve) => expo.listen(0, '127.0.0.1', resolve));
  pb = await startPocketBase({
    env: { PAWLY_PUSH_URL: `http://127.0.0.1:${expo.address().port}/push` },
  });
});

after(() => {
  pb?.stop();
  expo?.close();
});

beforeEach(() => {
  received = [];
});

const { verifiedUser } = accountHelpers(() => pb);
const ALERTS = '/api/collections/rescue_alerts/records';
const REPORTS = '/api/collections/rescue_reports/records';
const NOTIFICATIONS = '/api/collections/notifications/records';

/** Coyoacán, and points about 2 km and 8 km north of it. */
const COYOACAN = { latitude: 19.3467, longitude: -99.1617 };
const NORTH_2KM = { latitude: 19.3647, longitude: -99.1617 };
const NORTH_8KM = { latitude: 19.4187, longitude: -99.1617 };

function saveAlert(user, point, radiusKm = 5) {
  return pb.api(ALERTS, {
    method: 'POST',
    token: user.token,
    body: { user: user.record.id, ...point, radiusKm },
  });
}

function report(user, fields = {}) {
  return pb.api(REPORTS, {
    method: 'POST',
    token: user.token,
    body: {
      reporter: user.record.id,
      kind: 'lost',
      description: 'Se perdió Luna',
      lastSeenAt: new Date().toISOString().replace('T', ' '),
      ...COYOACAN,
      ...fields,
    },
  });
}

async function nearbyAlerts(user) {
  const filter = encodeURIComponent("type = 'rescue_nearby'");
  const { body } = await pb.api(`${NOTIFICATIONS}?filter=${filter}`, { token: user.token });
  return body.items;
}

describe('distances', () => {
  test('are measured along the Earth and rounded for alerts', () => {
    assert.equal(Math.round(distanceKm(COYOACAN, NORTH_2KM)), 2);
    assert.equal(Math.round(distanceKm(COYOACAN, NORTH_8KM)), 8);
    assert.equal(distanceKm(COYOACAN, COYOACAN), 0);
    assert.ok(Math.abs(roundCoordinate(19.3467) - 19.345) < 1e-9);
    assert.ok(Math.abs(roundCoordinate(-99.1617) - -99.16) < 1e-9);
    assert.equal(formatKm(2.04), '2');
    assert.equal(formatKm(1.46), '1.5');
    assert.equal(formatKm(12.6), '13');
    assert.equal(formatKm(0.02), '0.1');
  });
});

describe('saving an alert', () => {
  test('keeps only an approximate location, one per person', async () => {
    const luna = await verifiedUser();
    const { status, body } = await saveAlert(luna, COYOACAN, 10);
    assert.equal(status, 200, JSON.stringify(body));
    assert.ok(Math.abs(body.latitude - 19.345) < 1e-9);
    assert.ok(Math.abs(body.longitude - -99.16) < 1e-9);
    assert.equal(body.radiusKm, 10);
    assert.equal((await saveAlert(luna, COYOACAN)).status, 400);

    const moved = await pb.api(`${ALERTS}/${body.id}`, {
      method: 'PATCH',
      token: luna.token,
      body: { ...NORTH_8KM, radiusKm: 25 },
    });
    assert.equal(moved.status, 200);
    assert.ok(Math.abs(moved.body.latitude - 19.42) < 1e-9);
  });

  test('checks the radius and the location', async () => {
    const luna = await verifiedUser();
    const radius = await saveAlert(luna, COYOACAN, 3);
    assert.equal(radius.body.data.radiusKm.code, 'invalid_radius');
    const empty = await saveAlert(luna, { latitude: 0, longitude: 0 });
    assert.equal(empty.body.data.latitude.code, 'location_required');
  });

  test('only its owner sees, changes and deletes it', async () => {
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const { body: alert } = await saveAlert(luna, COYOACAN);
    const url = `${ALERTS}/${alert.id}`;
    assert.equal((await pb.api(url, { token: rocco.token })).status, 404);
    assert.equal((await pb.api(url)).status, 404);
    const forOther = await pb.api(ALERTS, {
      method: 'POST',
      token: rocco.token,
      body: { user: luna.record.id, ...COYOACAN, radiusKm: 5 },
    });
    assert.equal(forOther.status, 400);
    assert.equal((await pb.api(url, { method: 'DELETE', token: rocco.token })).status, 404);
    assert.equal((await pb.api(url, { method: 'DELETE', token: luna.token })).status, 204);
  });
});

describe('alerting', () => {
  test('a new report reaches everyone whose radius includes it, once, with the distance', async () => {
    const sol = await verifiedUser();
    const near = await verifiedUser();
    const farSmall = await verifiedUser();
    const farLarge = await verifiedUser();
    const without = await verifiedUser();
    await saveAlert(sol, COYOACAN, 25);
    await saveAlert(near, NORTH_2KM, 5);
    await saveAlert(farSmall, NORTH_8KM, 5);
    await saveAlert(farLarge, NORTH_8KM, 10);
    await pb.api('/api/collections/push_tokens/records', {
      method: 'POST',
      token: near.token,
      body: {
        user: near.record.id,
        token: `ExponentPushToken[near-${Date.now()}]`,
        language: 'es',
      },
    });

    const { body: created } = await report(sol);
    const [alert] = await nearbyAlerts(near);
    assert.equal(alert.rescue, created.id);
    assert.equal(alert.actor, sol.record.id);
    assert.equal(alert.distanceKm, 2);
    // Saved locations are rounded to about 500 m, so this one ends up 8.2 km away.
    assert.equal((await nearbyAlerts(farLarge))[0].distanceKm, 8.2);
    assert.equal((await nearbyAlerts(farSmall)).length, 0);
    assert.equal((await nearbyAlerts(without)).length, 0);
    assert.equal((await nearbyAlerts(sol)).length, 0);
    assert.equal((await nearbyAlerts(near)).length, 1);

    assert.deepEqual(
      received.map((message) => [message.body, message.data]),
      [
        [
          'Mascota perdida a 2 km de ti.',
          { type: 'rescue_nearby', rescueId: created.id, actorId: sol.record.id },
        ],
      ],
    );

    // Editing the report does not alert again.
    await pb.api(`${REPORTS}/${created.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { description: 'Se perdió Luna, collar rojo' },
    });
    assert.equal((await nearbyAlerts(near)).length, 1);
  });

  test('nobody is alerted across a block', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    await saveAlert(luna, COYOACAN, 5);
    await pb.api('/api/collections/blocks/records', {
      method: 'POST',
      token: luna.token,
      body: { blocker: luna.record.id, blocked: sol.record.id },
    });
    await report(sol, { kind: 'found' });
    assert.equal((await nearbyAlerts(luna)).length, 0);
  });
});
