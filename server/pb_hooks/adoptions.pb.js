/// <reference path="../pb_data/types.d.ts" />

// Adoption listing rules the collection settings cannot express:
// - only the publisher's own pets can be listed, and a pet has one available listing at most;
// - a new listing is always available, and the pet and the status cannot be changed by
//   editing it (marking it adopted comes with stage 5's adoption flow);
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
    if (!e.hasSuperuserAuth()) record.set('status', 'available');
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
    record.set('pet', original.getString('pet'));
    record.set('status', original.getString('status'));
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
