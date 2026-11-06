// End-to-end tests of "I can help": offering and withdrawing, the count, who sees the offers,
// the rules, the first offer moving the case along, and the reporter's notification.
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
const REPORTS = '/api/collections/rescue_reports/records';
const HELPERS = '/api/collections/rescue_helpers/records';
const NOTIFICATIONS = '/api/collections/notifications/records';

async function reportOf(user, fields = {}) {
  const { status, body } = await pb.api(REPORTS, {
    method: 'POST',
    token: user.token,
    body: {
      reporter: user.record.id,
      kind: 'help',
      description: 'Perrito atrapado en una coladera',
      latitude: 19.35,
      longitude: -99.16,
      urgency: 'high',
      ...fields,
    },
  });
  assert.equal(status, 200, JSON.stringify(body));
  return body;
}

function offer(user, report, message = '  Vivo a dos calles  ') {
  return pb.api(HELPERS, {
    method: 'POST',
    token: user?.token,
    body: { report: report.id, helper: user?.record.id, message },
  });
}

const getReport = async (report) => (await pb.api(`${REPORTS}/${report.id}`)).body;

describe('offering help', () => {
  test('the first offer moves the case to in progress and tells the reporter', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const report = await reportOf(sol);
    const { status, body } = await offer(luna, report);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.message, 'Vivo a dos calles');

    const updated = await getReport(report);
    assert.equal(updated.status, 'in_progress');
    assert.equal(updated.helperCount, 1);

    const { body: list } = await pb.api(`${NOTIFICATIONS}?sort=-created`, { token: sol.token });
    assert.equal(list.items[0].type, 'rescue_help');
    assert.equal(list.items[0].actor, luna.record.id);
    assert.equal(list.items[0].rescue, report.id);
  });

  test('the count follows offers and withdrawals; nobody sets it by hand', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const report = await reportOf(sol, { helperCount: 9 });
    assert.equal(report.helperCount, 0);
    const { body: lunaOffer } = await offer(luna, report);
    await offer(rocco, report);
    assert.equal((await getReport(report)).helperCount, 2);

    const withdrawn = await pb.api(`${HELPERS}/${lunaOffer.id}`, {
      method: 'DELETE',
      token: luna.token,
    });
    assert.equal(withdrawn.status, 204);
    assert.equal((await getReport(report)).helperCount, 1);

    const edited = await pb.api(`${REPORTS}/${report.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { helperCount: 50 },
    });
    assert.equal(edited.body.helperCount, 1);
  });

  test('only open cases of animals that need help, never your own, once', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const report = await reportOf(sol);
    const code = async (response) => (await response).body.data?.report?.code;

    assert.equal(await code(offer(sol, report)), 'own_report');
    assert.equal((await offer(luna, report)).status, 200);
    assert.equal(await code(offer(luna, report)), 'already_helping');

    const found = await reportOf(sol, { kind: 'found' });
    assert.equal(await code(offer(luna, found)), 'not_help');

    const closed = await reportOf(sol);
    await pb.api(`${REPORTS}/${closed.id}`, {
      method: 'PATCH',
      token: sol.token,
      body: { status: 'closed' },
    });
    assert.equal(await code(offer(luna, closed)), 'report_closed');

    const visitor = await pb.api(HELPERS, {
      method: 'POST',
      body: { report: report.id, helper: luna.record.id },
    });
    assert.equal(visitor.status, 400);
  });

  test('nobody offers across a block, and nobody offers in the name of others', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const report = await reportOf(sol);
    await pb.api('/api/collections/blocks/records', {
      method: 'POST',
      token: sol.token,
      body: { blocker: sol.record.id, blocked: luna.record.id },
    });
    assert.equal((await offer(luna, report)).body.data.report.code, 'blocked');
    const forOther = await pb.api(HELPERS, {
      method: 'POST',
      token: rocco.token,
      body: { report: report.id, helper: luna.record.id },
    });
    assert.equal(forOther.status, 400);
  });
});

describe('seeing offers', () => {
  test('only the helper and the reporter see an offer; nobody edits it', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const rocco = await verifiedUser();
    const report = await reportOf(sol);
    const { body: created } = await offer(luna, report);
    const url = `${HELPERS}/${created.id}`;
    assert.equal((await pb.api(url, { token: luna.token })).status, 200);
    assert.equal((await pb.api(url, { token: sol.token })).status, 200);
    assert.equal((await pb.api(url, { token: rocco.token })).status, 404);
    assert.equal((await pb.api(url)).status, 404);

    const filter = encodeURIComponent(`report = "${report.id}"`);
    const { body } = await pb.api(`${HELPERS}?filter=${filter}&expand=helper`, {
      token: sol.token,
    });
    assert.deepEqual(
      body.items.map((item) => item.expand.helper.username),
      [luna.record.username],
    );

    const edited = await pb.api(url, {
      method: 'PATCH',
      token: luna.token,
      body: { message: 'Otro' },
    });
    assert.equal(edited.status, 403);
    assert.equal((await pb.api(url, { method: 'DELETE', token: sol.token })).status, 404);
  });

  test('offers go away with the report and with the account', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const report = await reportOf(sol);
    const { body: created } = await offer(luna, report);
    await pb.api(`${USERS}/records/${luna.record.id}`, { method: 'DELETE', token: luna.token });
    assert.equal((await pb.api(`${HELPERS}/${created.id}`, { token: sol.token })).status, 404);
    assert.equal((await getReport(report)).helperCount, 0);
  });
});
