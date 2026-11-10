// End-to-end tests of shelter and rescuer accounts: sending a verification request, who sees
// it and its documents, and what happens when a superuser approves, rejects or revokes it.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { accountHelpers, USERS } from './helpers/accounts.mjs';
import { png } from './helpers/files.mjs';
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
const NOTIFICATIONS = '/api/collections/notifications/records';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n');

function rescuer(user, fields = {}) {
  return {
    user: user.record.id,
    kind: 'rescuer',
    publicName: 'Rescates Lupita',
    about: 'Rescato perros de la calle en Coyoacán desde 2019.',
    links: 'https://instagram.com/rescateslupita',
    ...fields,
  };
}

function send(user, body) {
  return pb.api(REQUESTS, { method: 'POST', token: user?.token, body });
}

/** Sends a request with files, as the app does. */
async function sendWithFiles(user, fields, files) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  for (const file of files) {
    form.append('documents', new Blob([file.bytes], { type: file.type }), file.name);
  }
  const response = await fetch(`${pb.baseUrl}${REQUESTS}`, {
    method: 'POST',
    headers: { Authorization: user.token },
    body: form,
  });
  return { status: response.status, body: await response.json() };
}

function shelter(user) {
  return sendWithFiles(
    user,
    rescuer(user, { kind: 'shelter', publicName: 'Refugio Patitas', links: '' }),
    [
      { name: 'acta.pdf', type: 'application/pdf', bytes: PDF },
      { name: 'constancia.png', type: 'image/png', bytes: png() },
    ],
  );
}

function review(id, body) {
  return pb.api(`${REQUESTS}/${id}`, { method: 'PATCH', token: admin, body });
}

async function profile(user) {
  const { body } = await pb.api(`${USERS}/records/${user.record.id}`);
  return body;
}

async function notices(user) {
  const { body } = await pb.api(`${NOTIFICATIONS}?sort=created`, { token: user.token });
  return body.items.filter((item) => item.type.startsWith('verification_'));
}

describe('sending a request', () => {
  test('a rescuer asks, and the request always starts in review', async () => {
    const user = await verifiedUser();
    const { status, body } = await send(
      user,
      rescuer(user, { status: 'approved', reviewNote: 'Yo mismo', publicName: '  Rescates Lupita ' }),
    );
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.status, 'pending');
    assert.equal(body.reviewNote, '');
    assert.equal(body.publicName, 'Rescates Lupita');
    // Asking does not change the account.
    const account = await profile(user);
    assert.equal(account.accountKind, '');
    assert.equal(account.publicName, '');
  });

  test('a shelter must attach its documents, which only it can open', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    const none = await send(user, rescuer(user, { kind: 'shelter' }));
    assert.equal(none.body.data.documents.code, 'documents_required');

    const { status, body } = await shelter(user);
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.kind, 'shelter');
    assert.equal(body.documents.length, 2);

    const file = `${pb.baseUrl}/api/files/${body.collectionId}/${body.id}/${body.documents[0]}`;
    assert.notEqual((await fetch(file)).status, 200);
    const tokenOf = async (token) =>
      (await pb.api('/api/files/token', { method: 'POST', token })).body.token;
    assert.notEqual((await fetch(`${file}?token=${await tokenOf(other.token)}`)).status, 200);
    assert.equal((await fetch(`${file}?token=${await tokenOf(user.token)}`)).status, 200);
    assert.equal((await fetch(`${file}?token=${await tokenOf(admin)}`)).status, 200);
  });

  test('the name, what they do and a known kind are required', async () => {
    const user = await verifiedUser();
    const noName = await send(user, rescuer(user, { publicName: '   ' }));
    assert.ok(noName.body.data.publicName);
    const noAbout = await send(user, rescuer(user, { about: '' }));
    assert.ok(noAbout.body.data.about);
    const badKind = await send(user, rescuer(user, { kind: 'clinic' }));
    assert.ok(badKind.body.data.kind);
    const badFile = await sendWithFiles(user, rescuer(user), [
      { name: 'nota.txt', type: 'text/plain', bytes: Buffer.from('hola') },
    ]);
    assert.ok(badFile.body.data.documents);
  });

  test('one request in review per account, and it can be cancelled', async () => {
    const user = await verifiedUser();
    const first = await send(user, rescuer(user));
    const second = await send(user, rescuer(user));
    assert.equal(second.body.data.user.code, 'already_pending');

    const cancelled = await pb.api(`${REQUESTS}/${first.body.id}`, {
      method: 'DELETE',
      token: user.token,
    });
    assert.equal(cancelled.status, 204);
    assert.equal((await send(user, rescuer(user))).status, 200);
  });

  test('only the applicant sees a request, and nobody asks for someone else', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    const { body } = await send(user, rescuer(user));

    assert.equal((await send(undefined, rescuer(user))).status, 400);
    assert.equal((await send(other, rescuer(user))).status, 400);
    const seen = await pb.api(`${REQUESTS}/${body.id}`, { token: other.token });
    assert.equal(seen.status, 404);
    const listed = await pb.api(REQUESTS, { token: other.token });
    assert.equal(listed.body.items.length, 0);
    assert.equal((await pb.api(REQUESTS)).body.items.length, 0);
    const mine = await pb.api(REQUESTS, { token: user.token });
    assert.equal(mine.body.items.length, 1);

    // The applicant cannot review their own request, nor can anyone else.
    for (const token of [user.token, other.token]) {
      const changed = await pb.api(`${REQUESTS}/${body.id}`, {
        method: 'PATCH',
        token,
        body: { status: 'approved' },
      });
      assert.notEqual(changed.status, 200);
    }
    const removed = await pb.api(`${REQUESTS}/${body.id}`, { method: 'DELETE', token: other.token });
    assert.equal(removed.status, 404);
  });
});

describe('reviewing a request', () => {
  test('approving makes the account a verified rescuer and tells the person', async () => {
    const user = await verifiedUser();
    const { body: request } = await send(user, rescuer(user));
    const { status, body } = await review(request.id, { status: 'approved' });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.status, 'approved');
    assert.ok(body.reviewedAt);

    const account = await profile(user);
    assert.equal(account.accountKind, 'rescuer');
    assert.equal(account.publicName, 'Rescates Lupita');
    const [notice] = await notices(user);
    assert.equal(notice.type, 'verification_approved');
    assert.equal(notice.actor, '');

    // An approved request stays: it cannot be cancelled.
    const removed = await pb.api(`${REQUESTS}/${request.id}`, {
      method: 'DELETE',
      token: user.token,
    });
    assert.equal(removed.status, 404);
  });

  test('rejecting needs a reason, tells the person and lets them ask again', async () => {
    const user = await verifiedUser();
    const { body: request } = await send(user, rescuer(user));
    const noNote = await review(request.id, { status: 'rejected' });
    assert.equal(noNote.body.data.reviewNote.code, 'note_required');

    const rejected = await review(request.id, {
      status: 'rejected',
      reviewNote: 'Los enlaces no muestran tu actividad.',
    });
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    assert.equal((await profile(user)).accountKind, '');
    const [notice] = await notices(user);
    assert.equal(notice.type, 'verification_rejected');

    // The person reads the reason in their request, and can send another one.
    const mine = await pb.api(`${REQUESTS}/${request.id}`, { token: user.token });
    assert.equal(mine.body.reviewNote, 'Los enlaces no muestran tu actividad.');
    assert.equal((await send(user, rescuer(user))).status, 200);
  });

  test('revoking makes it a regular account again', async () => {
    const user = await verifiedUser();
    const { body: request } = await shelter(user);
    await review(request.id, { status: 'approved' });
    assert.equal((await profile(user)).accountKind, 'shelter');

    const revoked = await review(request.id, { status: 'revoked', reviewNote: 'Reportes de fraude' });
    assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
    const account = await profile(user);
    assert.equal(account.accountKind, '');
    assert.equal(account.publicName, '');
    assert.deepEqual(
      (await notices(user)).map((notice) => notice.type),
      ['verification_approved', 'verification_revoked'],
    );
  });

  test('a new approved request replaces the earlier one', async () => {
    const user = await verifiedUser();
    const { body: first } = await send(user, rescuer(user));
    await review(first.id, { status: 'approved' });
    const { body: second } = await send(user, rescuer(user, { publicName: 'Huellitas Lupita' }));
    await review(second.id, { status: 'approved' });

    assert.equal((await profile(user)).publicName, 'Huellitas Lupita');
    const { body: earlier } = await pb.api(`${REQUESTS}/${first.id}`, { token: admin });
    assert.equal(earlier.status, 'replaced');
  });

  test('the review cannot change who asked or the kind, nor skip steps', async () => {
    const user = await verifiedUser();
    const other = await verifiedUser();
    const { body: request } = await send(user, rescuer(user));

    const skipped = await review(request.id, { status: 'revoked' });
    assert.equal(skipped.body.data.status.code, 'invalid_status');
    const { body } = await review(request.id, {
      status: 'approved',
      user: other.record.id,
      kind: 'shelter',
    });
    assert.equal(body.user, user.record.id);
    assert.equal(body.kind, 'rescuer');
    assert.equal((await profile(other)).accountKind, '');
    assert.equal((await profile(user)).accountKind, 'rescuer');

    const back = await review(request.id, { status: 'pending' });
    assert.equal(back.body.data.status.code, 'invalid_status');
    // A note alone changes nothing else.
    const noted = await review(request.id, { reviewNote: 'Revisado por teléfono' });
    assert.equal(noted.status, 200);
    assert.equal(noted.body.reviewedAt, body.reviewedAt);
    assert.equal((await notices(user)).length, 1);
  });
});

describe('the account', () => {
  test('nobody marks their own account as verified', async () => {
    const user = await verifiedUser();
    const changed = await pb.api(`${USERS}/records/${user.record.id}`, {
      method: 'PATCH',
      token: user.token,
      body: { accountKind: 'shelter', publicName: 'Refugio Falso', bio: 'Hola' },
    });
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal(changed.body.bio, 'Hola');
    assert.equal(changed.body.accountKind, '');
    assert.equal(changed.body.publicName, '');

    const created = await signUp(newAccount({ accountKind: 'shelter', publicName: 'Refugio Falso' }));
    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.accountKind, '');
    assert.equal(created.body.publicName, '');
  });

  test('editing the profile keeps the verification', async () => {
    const user = await verifiedUser();
    const { body: request } = await send(user, rescuer(user));
    await review(request.id, { status: 'approved' });
    const changed = await pb.api(`${USERS}/records/${user.record.id}`, {
      method: 'PATCH',
      token: user.token,
      body: { bio: 'Rescato perritos', publicName: 'Otro Nombre', accountKind: '' },
    });
    assert.equal(changed.body.accountKind, 'rescuer');
    assert.equal(changed.body.publicName, 'Rescates Lupita');
  });

  test('requests go away with the account', async () => {
    const user = await verifiedUser();
    const { body: request } = await shelter(user);
    const deleted = await pb.api(`${USERS}/records/${user.record.id}`, {
      method: 'DELETE',
      token: user.token,
    });
    assert.equal(deleted.status, 204);
    const gone = await pb.api(`${REQUESTS}/${request.id}`, { token: admin });
    assert.equal(gone.status, 404);
  });
});
