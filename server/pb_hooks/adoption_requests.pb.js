/// <reference path="../pb_data/types.d.ts" />

// Adoption request rules the collection settings cannot express. Each handler runs on its own.

// A new request starts as pending, with a trimmed message. Nobody requests their own listing,
// a listing that is no longer available, across a block, or twice.
onRecordCreateRequest((e) => {
  const { hasBlock } = require(`${__hooks}/lib/moderation.js`);
  const fail = (field, code, message) => {
    throw new BadRequestError('Invalid adoption request.', {
      [field]: new ValidationError(code, message),
    });
  };

  const record = e.record;
  record.set('status', 'pending');
  record.set('message', record.getString('message').trim());

  let adoption = null;
  try {
    adoption = e.app.findRecordById('adoptions', record.getString('adoption'));
  } catch {
    // A missing listing is rejected by the relation field itself.
  }
  if (adoption) {
    const applicant = record.getString('applicant');
    const publisher = adoption.getString('publisher');
    if (applicant === publisher) {
      fail('adoption', 'own_adoption', 'You cannot ask to adopt your own pet.');
    }
    if (adoption.getString('status') !== 'available') {
      fail('adoption', 'adoption_closed', 'This pet is no longer up for adoption.');
    }
    if (hasBlock(e.app, applicant, publisher)) {
      fail('adoption', 'blocked', 'You cannot do this because of a block.');
    }
    const existing = e.app.findRecordsByFilter(
      'adoption_requests',
      'adoption = {:adoption} && applicant = {:applicant}',
      '',
      1,
      0,
      { adoption: adoption.id, applicant },
    );
    if (existing.length > 0) {
      fail('adoption', 'already_requested', 'You already asked to adopt this pet.');
    }
  }
  e.next();
}, 'adoption_requests');

// Only the status changes, and only while the listing is available:
// - the applicant withdraws a pending or accepted request;
// - the publisher accepts or rejects a request that was not withdrawn.
onRecordUpdateRequest((e) => {
  if (e.hasSuperuserAuth()) return e.next();
  const fail = (code, message) => {
    throw new BadRequestError('Invalid adoption request.', {
      status: new ValidationError(code, message),
    });
  };

  const record = e.record;
  const original = record.original();
  for (const field of ['adoption', 'applicant', 'message']) {
    record.set(field, original.get(field));
  }
  const from = original.getString('status');
  const to = record.getString('status');
  if (from !== to) {
    const adoption = e.app.findRecordById('adoptions', record.getString('adoption'));
    if (adoption.getString('status') !== 'available') {
      fail('adoption_closed', 'This pet is no longer up for adoption.');
    }
    const me = e.auth ? e.auth.id : '';
    const byApplicant =
      me === record.getString('applicant') &&
      to === 'withdrawn' &&
      (from === 'pending' || from === 'accepted');
    const byPublisher =
      me === adoption.getString('publisher') &&
      (to === 'accepted' || to === 'rejected') &&
      from !== 'withdrawn';
    if (!byApplicant && !byPublisher) {
      fail('invalid_status', 'This change is not allowed.');
    }
  }
  e.next();
}, 'adoption_requests');
