/// <reference path="../pb_data/types.d.ts" />

// Adoption listing rules the collection settings cannot express:
// - only the publisher's own pets can be listed, and a pet has one available listing at most;
// - a new listing is always available; the pet, the status and the adoption data cannot be
//   changed by editing it (the adopt route below marks it adopted), and an adopted listing
//   cannot be edited at all;
// - texts are trimmed, so a zone of only spaces counts as empty;
// - photos are limited to 10 MB (videos keep the 50 MB field limit).
function validateAdoption(e) {
  const { isPhoto, MAX_PHOTO_SIZE } = require(`${__hooks}/lib/posts.js`);

  const record = e.record;
  const fail = (field, code, message) => {
    throw new BadRequestError('Invalid adoption listing.', {
      [field]: new ValidationError(code, message),
    });
  };

  for (const field of ['zone', 'health', 'requirements', 'description']) {
    record.set(field, record.getString(field).trim());
  }

  if (record.isNew()) {
    if (!e.hasSuperuserAuth()) {
      record.set('status', 'available');
      record.set('adopter', '');
      record.set('adoptedAt', '');
    }
    const petId = record.getString('pet');
    if (petId) {
      let owner = '';
      try {
        owner = e.app.findRecordById('pets', petId).getString('owner');
      } catch {
        // A missing pet is rejected by the relation field itself.
      }
      if (owner && owner !== record.getString('publisher')) {
        fail('pet', 'pet_not_owned', 'You can only put your own pets up for adoption.');
      }
      if (record.getString('status') === 'available') {
        const listed = e.app.findRecordsByFilter(
          'adoptions',
          "pet = {:pet} && status = 'available'",
          '',
          1,
          0,
          { pet: petId },
        );
        if (listed.length > 0) {
          fail('pet', 'pet_already_listed', 'This pet is already up for adoption.');
        }
      }
    }
  } else if (!e.hasSuperuserAuth()) {
    const original = record.original();
    if (original.getString('status') === 'adopted') {
      fail('status', 'adoption_closed', 'An adopted listing cannot be changed.');
    }
    for (const field of ['pet', 'status', 'adopter', 'adoptedAt']) {
      record.set(field, original.get(field));
    }
  }

  const bigPhoto = record
    .getUnsavedFiles('media')
    .find((file) => isPhoto(file.originalName) && file.size > MAX_PHOTO_SIZE);
  if (bigPhoto) {
    fail('media', 'photo_too_large', 'Photos can be up to 10 MB.');
  }
  e.next();
}

onRecordCreateRequest(validateAdoption, 'adoptions');
onRecordUpdateRequest(validateAdoption, 'adoptions');

// Marks a listing as adopted by someone whose request the publisher accepted (body:
// `{ "request": "<id>" }`). Only the publisher, only while the listing is available. In one
// transaction: the listing records the adopter and the date, the pet moves to the adopter
// (keeping the previous owner and the date), the other open requests are rejected, and the
// four follow-ups are scheduled (pb_hooks/lib/followups.js).
// Then the adopter is congratulated and the other applicants are told.
routerAdd(
  'POST',
  '/api/pawly/adoptions/{id}/adopt',
  (e) => {
    const fail = (field, code, message) => {
      throw new BadRequestError('The adoption could not be completed.', {
        [field]: new ValidationError(code, message),
      });
    };

    let adoption;
    try {
      adoption = e.app.findRecordById('adoptions', e.request.pathValue('id'));
    } catch {
      throw new NotFoundError('The listing was not found.');
    }
    const publisher = adoption.getString('publisher');
    if (publisher !== e.auth.id) {
      throw new ForbiddenError('Only the publisher can mark the pet as adopted.');
    }
    if (adoption.getString('status') !== 'available') {
      fail('adoption', 'adoption_closed', 'This pet was already adopted.');
    }

    const requestId = String(e.requestInfo().body.request || '');
    let chosen = null;
    try {
      chosen = e.app.findRecordById('adoption_requests', requestId);
    } catch {
      // Handled below.
    }
    if (
      !chosen ||
      chosen.getString('adoption') !== adoption.id ||
      chosen.getString('status') !== 'accepted'
    ) {
      fail('request', 'request_not_accepted', 'Choose someone whose request you accepted.');
    }
    const adopter = chosen.getString('applicant');
    const pet = e.app.findRecordById('pets', adoption.getString('pet'));
    if (pet.getString('owner') !== publisher) {
      fail('adoption', 'pet_not_owned', 'This pet is no longer yours.');
    }

    const { createFollowups, toServerDate } = require(`${__hooks}/lib/followups.js`);
    const adoptedAt = new Date();
    const now = toServerDate(adoptedAt);
    const rejected = [];
    e.app.runInTransaction((txApp) => {
      adoption.set('status', 'adopted');
      adoption.set('adopter', adopter);
      adoption.set('adoptedAt', now);
      txApp.save(adoption);

      pet.set('owner', adopter);
      pet.set('previousOwner', publisher);
      pet.set('adoptedAt', now);
      txApp.save(pet);

      const others = txApp.findRecordsByFilter(
        'adoption_requests',
        "adoption = {:adoption} && id != {:chosen} && (status = 'pending' || status = 'accepted')",
        '',
        0,
        0,
        { adoption: adoption.id, chosen: chosen.id },
      );
      for (const other of others) {
        other.set('status', 'rejected');
        txApp.save(other);
        rejected.push(other.getString('applicant'));
      }

      createFollowups(txApp, adoption.id, adoptedAt);
    });

    const { notify } = require(`${__hooks}/lib/notifications.js`);
    notify(e.app, { recipient: adopter, actor: publisher, type: 'adopted', adoption: adoption.id });
    for (const applicant of rejected) {
      notify(e.app, {
        recipient: applicant,
        actor: publisher,
        type: 'request_rejected',
        adoption: adoption.id,
      });
    }

    return e.json(200, e.app.findRecordById('adoptions', adoption.id));
  },
  $apis.requireAuth('users'),
);
