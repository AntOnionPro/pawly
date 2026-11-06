// Tests of the content filter: how texts are compared, what blocks a save, what goes to
// review, and who manages the list.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, describe, test } from 'node:test';

import { accountHelpers } from './helpers/accounts.mjs';
import { startPocketBase } from './helpers/pocketbase.mjs';

const require = createRequire(import.meta.url);
const { normalize, findTerm } = require('../pb_hooks/lib/filter.js');

let pb;
let admin;

before(async () => {
  pb = await startPocketBase();
  admin = await superuserToken();
});

after(() => pb?.stop());

const { verifiedUser, signUp, newAccount, superuserToken } = accountHelpers(() => pb);
const TERMS = '/api/collections/blocked_terms/records';
const REPORTS = '/api/collections/reports/records';

function save(user, collection, body, id) {
  return pb.api(`/api/collections/${collection}/records${id ? `/${id}` : ''}`, {
    method: id ? 'PATCH' : 'POST',
    token: user.token,
    body,
  });
}

async function created(user, collection, body) {
  const { status, body: record } = await save(user, collection, body);
  assert.equal(status, 200, JSON.stringify(record));
  return record;
}

async function automaticReports(kind, id) {
  const filter = encodeURIComponent(
    `reporter = '' && targetKind = "${kind}" && targetId = "${id}"`,
  );
  const { body } = await pb.api(`${REPORTS}?filter=${filter}`, { token: admin });
  return body.items;
}

function adoptionFields(user, pet, fields = {}) {
  return {
    publisher: user.record.id,
    pet: pet.id,
    sex: 'female',
    size: 'small',
    vaccines: 'complete',
    zone: 'Coyoacán, CDMX',
    description: 'Muy cariñosa',
    ...fields,
  };
}

describe('comparing texts', () => {
  const terms = [
    { term: 'pendejo', action: 'block' },
    { term: 'hijo de puta', action: 'block' },
    { term: 'puta', action: 'block' },
    { term: 'se vende', action: 'review', reason: 'animal_sale' },
    { term: 'maricón', action: 'block' },
  ];
  const found = (text) => findTerm(text, terms)?.term ?? null;

  test('ignores case, accents, repeated letters, look-alikes and punctuation', () => {
    assert.equal(normalize('¡PÉÑDEJOOO!!'), 'pendejo');
    assert.equal(found('Eres un PENDEJO'), 'pendejo');
    assert.equal(found('p3nd3j0'), 'pendejo');
    assert.equal(found('peeendejooo'), 'pendejo');
    assert.equal(found('hijo-de-puta'), 'hijo de puta');
    assert.equal(found('MARICON'), 'maricón');
    assert.equal(found('put@'), 'puta');
  });

  test('only matches whole words, so innocent words are not marked', () => {
    for (const text of [
      'Mi computadora nueva',
      'Una disputa entre gatos',
      'Mi perra y la zorra del bosque',
      'Imputable',
      'Pendiente de vacunas',
      '',
    ]) {
      assert.equal(found(text), null, text);
    }
  });

  test('a blocking term wins over a review term', () => {
    assert.equal(found('Se vende, pendejo'), 'pendejo');
    assert.equal(findTerm('Se vende perrito', terms)?.action, 'review');
  });
});

describe('blocking', () => {
  test('stops the post, comment and message, on the field', async () => {
    const sol = await verifiedUser();
    const luna = await verifiedUser();
    const post = await save(sol, 'posts', { author: sol.record.id, text: 'Eres un pendejo' });
    assert.equal(post.status, 400);
    assert.equal(post.body.data.text.code, 'content_blocked');

    const ok = await created(sol, 'posts', { author: sol.record.id, text: 'Hola' });
    const comment = await save(luna, 'comments', {
      author: luna.record.id,
      post: ok.id,
      text: 'P U T O no, pero puto sí',
    });
    assert.equal(comment.body.data.text.code, 'content_blocked');

    const conversation = await created(sol, 'conversations', {
      userA: sol.record.id,
      userB: luna.record.id,
    });
    const message = await save(sol, 'messages', {
      conversation: conversation.id,
      sender: sol.record.id,
      text: 'fuck you',
    });
    assert.equal(message.body.data.text.code, 'content_blocked');

    // Editing a post into a blocked text fails too, and keeps the old text.
    const edited = await save(sol, 'posts', { text: 'Ahora sí, culero' }, ok.id);
    assert.equal(edited.body.data.text.code, 'content_blocked');
    assert.equal((await pb.api(`/api/collections/posts/records/${ok.id}`)).body.text, 'Hola');
  });

  test('stops usernames, bios, pet names, listings and rescue reports', async () => {
    const signup = await signUp(newAccount({ username: 'puto.mx' }));
    assert.equal(signup.status, 400);
    assert.equal(signup.body.data.username.code, 'content_blocked');

    const sol = await verifiedUser();
    const bio = await save(sol, 'users', { bio: 'Hijo de puta' }, sol.record.id);
    assert.equal(bio.body.data.bio.code, 'content_blocked');
    const pet = await save(sol, 'pets', { owner: sol.record.id, name: 'Joto', species: 'dog' });
    assert.equal(pet.body.data.name.code, 'content_blocked');

    const luna = await created(sol, 'pets', { owner: sol.record.id, name: 'Luna', species: 'dog' });
    const listing = await save(
      sol,
      'adoptions',
      adoptionFields(sol, luna, { requirements: 'Nada de pendejos... pendejo' }),
    );
    assert.equal(listing.body.data.requirements.code, 'content_blocked');
    const rescue = await save(sol, 'rescue_reports', {
      reporter: sol.record.id,
      kind: 'help',
      urgency: 'low',
      description: 'Mátate',
      latitude: 19.35,
      longitude: -99.16,
    });
    assert.equal(rescue.body.data.description.code, 'content_blocked');
  });
});

describe('review', () => {
  test('saves the text and sends it to the queue once, without a reporter', async () => {
    const sol = await verifiedUser();
    const post = await created(sol, 'posts', { author: sol.record.id, text: 'Vendo cachorros' });
    const [report] = await automaticReports('post', post.id);
    assert.equal(report.reporter, '');
    assert.equal(report.post, post.id);
    assert.equal(report.reason, 'animal_sale');
    assert.equal(report.status, 'pending');
    assert.equal(report.targetAuthor, sol.record.id);
    assert.equal(report.targetText, 'Vendo cachorros');
    assert.match(report.details, /vendo/);

    // Editing it again while it is pending does not add another report.
    await created(sol, 'posts', { author: sol.record.id, text: 'Otra cosa' });
    const edited = await save(sol, 'posts', { text: 'Se venden cachorros' }, post.id);
    assert.equal(edited.status, 200);
    assert.equal((await automaticReports('post', post.id)).length, 1);

    // A listing about dog fights goes to review as animal abuse.
    const pet = await created(sol, 'pets', { owner: sol.record.id, name: 'Rocco', species: 'dog' });
    const listing = await created(
      sol,
      'adoptions',
      adoptionFields(sol, pet, { health: 'Lo rescaté de peleas de perros' }),
    );
    const [abuse] = await automaticReports('adoption', listing.id);
    assert.equal(abuse.reason, 'animal_abuse');

    // A pet is reviewed through its owner.
    const forSale = await created(sol, 'pets', {
      owner: sol.record.id,
      name: 'Toby',
      breed: 'Labrador en venta',
      species: 'dog',
    });
    assert.ok(forSale.id);
    assert.equal((await automaticReports('user', sol.record.id)).length, 1);
  });
});

describe('the list', () => {
  test('only superusers see and change it, and it applies at once', async () => {
    const sol = await verifiedUser();
    assert.equal((await pb.api(TERMS, { token: sol.token })).status, 403);
    assert.equal((await pb.api(TERMS)).status, 403);
    const { body } = await pb.api(`${TERMS}?perPage=200`, { token: admin });
    assert.ok(body.items.some((item) => item.term === 'pendejo' && item.action === 'block'));

    const added = await pb.api(TERMS, {
      method: 'POST',
      token: admin,
      body: { term: 'Mequetrefe', action: 'block', reason: 'offensive' },
    });
    assert.equal(added.status, 200);
    const now = await save(sol, 'posts', { author: sol.record.id, text: 'Mequetrefe' });
    assert.equal(now.body.data.text.code, 'content_blocked');

    // Old content can still be edited in its other fields, and superusers are not filtered.
    const pet = await created(sol, 'pets', { owner: sol.record.id, name: 'Kira', species: 'cat' });
    const listing = await created(
      sol,
      'adoptions',
      adoptionFields(sol, pet, { description: 'Mi gata' }),
    );
    await pb.api(`/api/collections/adoptions/records/${listing.id}`, {
      method: 'PATCH',
      token: admin,
      body: { description: 'Mi gata mequetrefe' },
    });
    const zone = await save(sol, 'adoptions', { zone: 'Tlalpan, CDMX' }, listing.id);
    assert.equal(zone.status, 200);
    assert.equal(zone.body.description, 'Mi gata mequetrefe');
  });
});
