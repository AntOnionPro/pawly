/// <reference path="../pb_data/types.d.ts" />

// Rescue report rules the collection settings cannot express:
// - a report needs a GPS location (latitude and longitude, not both 0);
// - a new report is open, and the kind and the reporter cannot change afterwards;
// - `in_progress` only exists for animals that need help;
// - needs help requires an urgency; only lost reports have a pet (one of the reporter's) and
//   a last-seen date (required, not in the future; the app sends the chosen day at noon UTC,
//   so a day and a half of margin covers every time zone); the other kinds drop those fields;
// - texts are trimmed, and photos are limited to 10 MB (videos keep the 50 MB field limit).
function validateRescue(e) {
  const { isPhoto, MAX_PHOTO_SIZE } = require(`${__hooks}/lib/posts.js`);
  const record = e.record;
  const fail = (field, code, message) => {
    throw new BadRequestError('Invalid rescue report.', {
      [field]: new ValidationError(code, message),
    });
  };

  for (const field of ['description', 'place']) {
    record.set(field, record.getString(field).trim());
  }

  if (record.isNew()) {
    if (!e.hasSuperuserAuth()) record.set('status', 'open');
  } else {
    const original = record.original();
    record.set('kind', original.getString('kind'));
    record.set('reporter', original.getString('reporter'));
  }

  const kind = record.getString('kind');
  if (kind === 'help') {
    if (!record.getString('urgency')) fail('urgency', 'validation_required', 'Choose an urgency.');
  } else {
    record.set('urgency', '');
  }

  if (kind === 'lost') {
    const lastSeen = record.getString('lastSeenAt');
    if (!lastSeen) fail('lastSeenAt', 'validation_required', 'Say when it was last seen.');
    const margin = 36 * 60 * 60 * 1000;
    if (new Date(lastSeen.replace(' ', 'T')).getTime() > Date.now() + margin) {
      fail('lastSeenAt', 'date_future', 'The date cannot be in the future.');
    }
    const petId = record.getString('pet');
    if (petId && (record.isNew() || petId !== record.original().getString('pet'))) {
      let owner = '';
      try {
        owner = e.app.findRecordById('pets', petId).getString('owner');
      } catch {
        // A missing pet is rejected by the relation field itself.
      }
      if (owner && owner !== record.getString('reporter')) {
        fail('pet', 'pet_not_owned', 'You can only report your own pets as lost.');
      }
    }
  } else {
    record.set('pet', '');
    record.set('lastSeenAt', '');
  }

  if (record.getString('status') === 'in_progress' && kind !== 'help') {
    fail('status', 'invalid_status', 'Only animals that need help can be in progress.');
  }

  if (record.getFloat('latitude') === 0 && record.getFloat('longitude') === 0) {
    fail('latitude', 'location_required', 'Add the location.');
  }

  const bigPhoto = record
    .getUnsavedFiles('media')
    .find((file) => isPhoto(file.originalName) && file.size > MAX_PHOTO_SIZE);
  if (bigPhoto) fail('media', 'photo_too_large', 'Photos can be up to 10 MB.');
  e.next();
}

onRecordCreateRequest(validateRescue, 'rescue_reports');
onRecordUpdateRequest(validateRescue, 'rescue_reports');
