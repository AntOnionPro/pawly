/// <reference path="../pb_data/types.d.ts" />

// Account rules that the collection settings cannot express on their own.
// Each handler runs in its own JS runtime, so shared code is loaded with require().

// Sign-up: terms accepted and minimum age 13. The server records when the terms were accepted.
onRecordCreateRequest((e) => {
  if (e.hasSuperuserAuth()) {
    return e.next();
  }
  const { minimumAgeError } = require(`${__hooks}/lib/accounts.js`);

  const body = e.requestInfo().body;
  if (body.acceptTerms !== true && body.acceptTerms !== 'true') {
    throw new BadRequestError('The terms of service and the privacy notice must be accepted.', {
      acceptTerms: new ValidationError(
        'terms_required',
        'Accept the terms of service and the privacy notice.',
      ),
    });
  }

  // `birthdate` is a hidden field, so PocketBase drops it from a regular user's request.
  // The app sends it as `dateOfBirth` (not a field); it is validated and stored here.
  const birthdate = typeof body.dateOfBirth === 'string' ? body.dateOfBirth : '';
  const error = minimumAgeError(birthdate, new Date());
  if (error) {
    throw new BadRequestError('Invalid birth date.', {
      dateOfBirth: new ValidationError(error.code, error.message),
    });
  }

  e.record.set('birthdate', birthdate);
  e.record.set('termsAcceptedAt', new DateTime());
  e.next();
}, 'users');

// The birth date and the terms acceptance date cannot be changed afterwards.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const original = e.record.original();
    e.record.set('birthdate', original.get('birthdate'));
    e.record.set('termsAcceptedAt', original.get('termsAcceptedAt'));
  }
  e.next();
}, 'users');

// Sends the verification email right after sign-up.
onRecordAfterCreateSuccess((e) => {
  e.next();
  if (!e.record.verified()) {
    try {
      $mails.sendRecordVerification(e.app, e.record);
    } catch (err) {
      e.app.logger().error('Could not send the verification email', 'error', String(err));
    }
  }
}, 'users');

// Development: without SMTP there is nowhere to send emails, so they are printed to the
// console with their link (verification, password reset…). Production must configure SMTP.
onMailerSend((e) => {
  if (e.app.settings().smtp.enabled) {
    return e.next();
  }
  const message = e.message;
  const to = message.to.map((address) => address.address).join(', ');
  const link = (/href="([^"]+)"/.exec(message.html) || [])[1] || '(no link)';
  console.log(`[pawly-mail] to=${to} subject="${message.subject}" link=${link}`);
});
