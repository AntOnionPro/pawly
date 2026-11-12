/// <reference path="../pb_data/types.d.ts" />

// Shelter and rescuer accounts (stage 10): a person sends a verification request, and a
// superuser reviews it in the admin panel. Each handler runs on its own, so shared code is
// loaded with require().

// A new request always starts in review. A constituted shelter must attach its documents,
// and an account has one request in review at a time.
onRecordCreateRequest((e) => {
  const record = e.record;
  const fail = (field, code, message) => {
    throw new BadRequestError('Invalid verification request.', {
      [field]: new ValidationError(code, message),
    });
  };

  for (const field of ['publicName', 'about', 'links']) {
    record.set(field, record.getString(field).trim());
  }
  if (!e.hasSuperuserAuth()) {
    record.set('status', 'pending');
    record.set('reviewNote', '');
    record.set('reviewedAt', '');
  }

  if (record.getString('kind') === 'shelter' && record.getUnsavedFiles('documents').length === 0) {
    fail('documents', 'documents_required', "Attach the shelter's documents.");
  }
  if (record.getString('status') === 'pending') {
    const pending = e.app.findRecordsByFilter(
      'verification_requests',
      "user = {:user} && status = 'pending'",
      '',
      1,
      0,
      { user: record.getString('user') },
    );
    if (pending.length > 0) {
      fail('user', 'already_pending', 'There is already a request in review.');
    }
  }
  e.next();
}, 'verification_requests');

// The review (only superusers update a request). Who asked and for what kind of account never
// change. The status moves from `pending` to `approved` or `rejected` (with a note), and from
// `approved` to `revoked`; a rejected or revoked request can still be approved.
// - `approved` makes the account a shelter's or a rescuer's, with the request's public name,
//   and leaves an earlier approved request as `replaced`.
// - `revoked` makes it a regular account again, without its shelter or rescuer profile.
// The person is told each result in the app.
onRecordUpdateRequest((e) => {
  const record = e.record;
  const original = record.original();
  const fail = (field, code, message) => {
    throw new BadRequestError('Invalid review.', {
      [field]: new ValidationError(code, message),
    });
  };

  for (const field of ['user', 'kind']) record.set(field, original.get(field));
  record.set('publicName', record.getString('publicName').trim());
  record.set('reviewNote', record.getString('reviewNote').trim());

  const before = original.getString('status');
  const status = record.getString('status');
  const reviewed = status !== before;
  if (reviewed) {
    const from = {
      approved: ['pending', 'rejected', 'revoked'],
      rejected: ['pending'],
      revoked: ['approved'],
    };
    if (!(from[status] || []).includes(before)) {
      fail('status', 'invalid_status', `A ${before} request cannot become ${status}.`);
    }
    if (status === 'rejected' && !record.getString('reviewNote')) {
      fail('reviewNote', 'note_required', 'Say why the request is rejected.');
    }
    record.set('reviewedAt', new DateTime());
  } else {
    record.set('reviewedAt', original.get('reviewedAt'));
  }

  e.next();
  if (!reviewed) return;

  const { notifyFromPawly } = require(`${__hooks}/lib/notifications.js`);
  const userId = record.getString('user');
  const user = e.app.findRecordById('users', userId);
  if (status === 'approved') {
    const earlier = e.app.findRecordsByFilter(
      'verification_requests',
      "user = {:user} && status = 'approved' && id != {:me}",
      '',
      0,
      0,
      { user: userId, me: record.id },
    );
    for (const other of earlier) {
      other.set('status', 'replaced');
      e.app.save(other);
    }
    user.set('accountKind', record.getString('kind'));
    user.set('publicName', record.getString('publicName'));
    e.app.save(user);
  } else if (status === 'revoked') {
    const { clearShelterProfile } = require(`${__hooks}/lib/accounts.js`);
    user.set('accountKind', '');
    user.set('publicName', '');
    clearShelterProfile(user);
    e.app.save(user);
  }
  notifyFromPawly(e.app, { recipient: userId, type: `verification_${status}` });
}, 'verification_requests');
