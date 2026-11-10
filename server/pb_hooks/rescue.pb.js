/// <reference path="../pb_data/types.d.ts" />

// Rescue report rules the collection settings cannot express:
// - a report needs a GPS location (latitude and longitude, not both 0);
// - a new report is open, and the kind and the reporter cannot change afterwards;
// - `in_progress` only exists for animals that need help;
// - needs help requires an urgency; only lost reports have a pet (one of the reporter's) and
//   a last-seen date (required, not in the future; the app sends the chosen day at noon UTC,
//   so a day and a half of margin covers every time zone); the other kinds drop those fields;
// - a lost report with a pet takes the pet's species;
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
    let pet = null;
    if (petId) {
      try {
        pet = e.app.findRecordById('pets', petId);
      } catch {
        // A missing pet is rejected by the relation field itself.
      }
    }
    if (pet && (record.isNew() || petId !== record.original().getString('pet'))) {
      if (pet.getString('owner') !== record.getString('reporter')) {
        fail('pet', 'pet_not_owned', 'You can only report your own pets as lost.');
      }
    }
    // A lost pet is the animal of the report.
    if (pet) record.set('species', pet.getString('species'));
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

// "I can help": only for open or in-progress reports of animals that need help, never on your
// own report, across a block or twice. The message is trimmed.
onRecordCreateRequest((e) => {
  const { hasBlock } = require(`${__hooks}/lib/moderation.js`);
  const fail = (code, message) => {
    throw new BadRequestError('Invalid offer to help.', {
      report: new ValidationError(code, message),
    });
  };
  const record = e.record;
  record.set('message', record.getString('message').trim());
  let report = null;
  try {
    report = e.app.findRecordById('rescue_reports', record.getString('report'));
  } catch {
    // A missing report is rejected by the relation field itself.
  }
  if (report) {
    const helper = record.getString('helper');
    if (report.getString('kind') !== 'help') {
      fail('not_help', 'Only animals that need help take offers.');
    }
    if (report.getString('status') === 'closed') fail('report_closed', 'This case is closed.');
    if (report.getString('reporter') === helper) {
      fail('own_report', 'You cannot offer help with your own report.');
    }
    if (hasBlock(e.app, helper, report.getString('reporter'))) {
      fail('blocked', 'You cannot do this because of a block.');
    }
    const existing = e.app.findRecordsByFilter(
      'rescue_helpers',
      'report = {:report} && helper = {:helper}',
      '',
      1,
      0,
      { report: report.id, helper },
    );
    if (existing.length > 0) fail('already_helping', 'You already offered to help.');
  }
  e.next();
}, 'rescue_helpers');

// The first offer moves an open report to in progress, and the reporter is told.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { notify } = require(`${__hooks}/lib/notifications.js`);
  try {
    const report = e.app.findRecordById('rescue_reports', e.record.getString('report'));
    if (report.getString('status') === 'open') {
      report.set('status', 'in_progress');
      e.app.save(report);
    }
    notify(e.app, {
      recipient: report.getString('reporter'),
      actor: e.record.getString('helper'),
      type: 'rescue_help',
      rescue: report.id,
    });
  } catch (error) {
    console.log(`[pawly-rescue] help offer: ${error}`);
  }
}, 'rescue_helpers');
