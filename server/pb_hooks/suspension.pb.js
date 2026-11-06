/// <reference path="../pb_data/types.d.ts" />

// Account suspension (the fields are set by superusers in the admin panel). Each handler runs
// on its own, so shared code lives in lib/accounts.js.

// A suspended account cannot sign in (with a password, OAuth2 or a code) or renew its session.
onRecordAuthRequest((e) => {
  const { activeSuspension, suspendedResponse } = require(`${__hooks}/lib/accounts.js`);
  const suspension = activeSuspension(e.record);
  if (suspension) return suspendedResponse(e, suspension);
  return e.next();
}, 'users');

// A session that was open when the account was suspended stops working on its next request.
routerUse((e) => {
  const auth = e.auth;
  if (
    auth &&
    auth.collection().name === 'users' &&
    (auth.getBool('suspendedForever') || auth.getString('suspendedUntil'))
  ) {
    const { activeSuspension, suspendedResponse } = require(`${__hooks}/lib/accounts.js`);
    const suspension = activeSuspension(auth);
    if (suspension) return suspendedResponse(e, suspension);
  }
  return e.next();
});

// A suspended account gets no pushes: its phones are forgotten.
onRecordAfterUpdateSuccess((e) => {
  e.next();
  const { activeSuspension } = require(`${__hooks}/lib/accounts.js`);
  if (!activeSuspension(e.record)) return;
  const tokens = e.app.findRecordsByFilter('push_tokens', 'user = {:user}', '', 0, 0, {
    user: e.record.id,
  });
  for (const token of tokens) e.app.delete(token);
}, 'users');
