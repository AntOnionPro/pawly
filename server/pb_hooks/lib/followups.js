// Follow-up after an adoption (loaded with require() from the hooks).
//
// Each adopted listing gets four follow-ups: 1 week, 1 month, 3 months and 6 months after the
// adoption (`dueAt`). On that day the daily task reminds the adopter. A post by the adopter
// that tags the pet counts as the update of the follow-up whose window is open: from `dueAt`
// until GRACE_DAYS later. After that, a follow-up without a post is overdue and the previous
// owner can report the adopter.

const DAY = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 14;
const MILESTONES = [
  { name: 'week1', days: 7 },
  { name: 'month1', days: 30 },
  { name: 'month3', days: 90 },
  { name: 'month6', days: 180 },
];

/** PocketBase date text ("2026-11-05 18:00:00.000Z") for a JavaScript date. */
function toServerDate(date) {
  return date.toISOString().replace('T', ' ');
}

/** JavaScript date for a PocketBase date text. */
function fromServerDate(text) {
  return new Date(String(text).replace(' ', 'T'));
}

/** Creates the four follow-ups of an adoption completed at `adoptedAt` (a JavaScript date). */
function createFollowups(app, adoptionId, adoptedAt) {
  const collection = app.findCollectionByNameOrId('adoption_followups');
  for (const milestone of MILESTONES) {
    const record = new Record(collection);
    record.set('adoption', adoptionId);
    record.set('milestone', milestone.name);
    record.set('dueAt', toServerDate(new Date(adoptedAt.getTime() + milestone.days * DAY)));
    app.save(record);
  }
}

/**
 * Reminds adopters of the follow-ups that are due at `now` (a JavaScript date): due, without
 * an update, not reminded yet and still open. Returns how many reminders it sent.
 */
function sendReminders(app, now) {
  const { notify } = require(`${__hooks}/lib/notifications.js`);
  const due = app.findRecordsByFilter(
    'adoption_followups',
    "remindedAt = '' && post = '' && dueAt <= {:now} && dueAt > {:openSince}",
    'dueAt',
    0,
    0,
    {
      now: toServerDate(now),
      openSince: toServerDate(new Date(now.getTime() - GRACE_DAYS * DAY)),
    },
  );
  for (const followup of due) {
    const adoption = app.findRecordById('adoptions', followup.getString('adoption'));
    notify(app, {
      recipient: adoption.getString('adopter'),
      actor: adoption.getString('publisher'),
      type: 'followup_due',
      adoption: adoption.id,
      followup: followup.id,
    });
    followup.set('remindedAt', toServerDate(now));
    app.save(followup);
  }
  return due.length;
}

/**
 * Counts a new post as the update of an open follow-up: the author adopted a pet the post
 * tags, and the follow-up's window is open. Tells the previous owner.
 */
function recordUpdate(app, post) {
  const { notify } = require(`${__hooks}/lib/notifications.js`);
  const author = post.getString('author');
  const now = new Date();
  for (const petId of post.getStringSlice('pets')) {
    const open = app.findRecordsByFilter(
      'adoption_followups',
      "post = '' && adoption.pet = {:pet} && adoption.adopter = {:author} && " +
        'dueAt <= {:now} && dueAt > {:openSince}',
      'dueAt',
      1,
      0,
      {
        pet: petId,
        author,
        now: toServerDate(now),
        openSince: toServerDate(new Date(now.getTime() - GRACE_DAYS * DAY)),
      },
    );
    if (open.length === 0) continue;
    const followup = open[0];
    followup.set('post', post.id);
    app.save(followup);
    const adoption = app.findRecordById('adoptions', followup.getString('adoption'));
    notify(app, {
      recipient: adoption.getString('publisher'),
      actor: author,
      type: 'followup_posted',
      post: post.id,
      adoption: adoption.id,
      followup: followup.id,
    });
  }
}

/** Whether `adopterId` let a follow-up of a pet adopted from `publisherId` go overdue. */
function hasOverdueFollowup(app, publisherId, adopterId) {
  const overdue = app.findRecordsByFilter(
    'adoption_followups',
    "post = '' && adoption.publisher = {:publisher} && adoption.adopter = {:adopter} && " +
      'dueAt <= {:closedBefore}',
    '',
    1,
    0,
    {
      publisher: publisherId,
      adopter: adopterId,
      closedBefore: toServerDate(new Date(Date.now() - GRACE_DAYS * DAY)),
    },
  );
  return overdue.length > 0;
}

module.exports = {
  GRACE_DAYS,
  MILESTONES,
  createFollowups,
  fromServerDate,
  hasOverdueFollowup,
  recordUpdate,
  sendReminders,
  toServerDate,
};
