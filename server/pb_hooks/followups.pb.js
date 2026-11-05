/// <reference path="../pb_data/types.d.ts" />

// Follow-up after an adoption. Each handler runs on its own, so shared code lives in
// lib/followups.js.

// Every day at 15:00 UTC (9:00 in Mexico City): remind adopters of the follow-ups due today.
cronAdd('adoptionFollowups', '0 15 * * *', () => {
  const { sendReminders } = require(`${__hooks}/lib/followups.js`);
  try {
    sendReminders($app, new Date());
  } catch (error) {
    console.log(`[pawly-followups] ${error}`);
  }
});

// Runs the daily task now, optionally as if it were `now` (superusers only; the tests use it
// with simulated dates).
routerAdd(
  'POST',
  '/api/pawly/followups/run',
  (e) => {
    const { sendReminders } = require(`${__hooks}/lib/followups.js`);
    const body = e.requestInfo().body;
    const now = body.now ? new Date(String(body.now).replace(' ', 'T')) : new Date();
    if (Number.isNaN(now.getTime())) {
      throw new BadRequestError('Invalid date.', {
        now: new ValidationError('invalid_date', 'Send an ISO date.'),
      });
    }
    return e.json(200, { reminded: sendReminders(e.app, now) });
  },
  $apis.requireSuperuserAuth(),
);

// A post by an adopter that tags their adopted pet counts as the open follow-up's update.
onRecordAfterCreateSuccess((e) => {
  e.next();
  if (e.record.getStringSlice('pets').length === 0) return;
  const { recordUpdate } = require(`${__hooks}/lib/followups.js`);
  try {
    recordUpdate(e.app, e.record);
  } catch (error) {
    console.log(`[pawly-followups] update: ${error}`);
  }
}, 'posts');

// "Adoption follow-up not done": only the previous owner reports the adopter, and only after
// a follow-up went overdue.
onRecordCreateRequest((e) => {
  if (e.record.getString('reason') === 'adoption_followup') {
    const { hasOverdueFollowup } = require(`${__hooks}/lib/followups.js`);
    const adopter = e.record.getString('user');
    if (!adopter || !hasOverdueFollowup(e.app, e.record.getString('reporter'), adopter)) {
      throw new BadRequestError('Invalid report.', {
        reason: new ValidationError(
          'followup_not_overdue',
          'Only for an overdue follow-up of a pet you gave for adoption.',
        ),
      });
    }
  }
  e.next();
}, 'reports');
