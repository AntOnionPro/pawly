/// <reference path="../pb_data/types.d.ts" />

// Shelter and rescuer accounts (stage 10).
// - users: `accountKind` (`shelter` or `rescuer`; empty for everyone else) and `publicName`,
//   the name shown on a verified account. Everyone sees them and only the server sets them,
//   when a request is approved (pb_hooks/verification.pb.js).
// - verification_requests: a person asks for their account to be a shelter's or a rescuer's,
//   with the `publicName`, what they do (`about`), `links` where their work can be seen and,
//   for a constituted shelter, its `documents` (protected files: only the applicant and
//   superusers can open them). It starts `pending`; superusers review it in the admin panel
//   (`approved`, or `rejected` with a `reviewNote`) and can take the verification back later
//   (`revoked`). A newer approved request leaves the earlier one as `replaced`.
//   Only the applicant sees their requests, and can cancel one while it is pending.
// - notifications: `verification_approved`, `verification_rejected` and
//   `verification_revoked`, from Pawly (no actor).
const KINDS = ['shelter', 'rescuer'];
const NOTIFICATION_TYPES = [
  'verification_approved',
  'verification_rejected',
  'verification_revoked',
];

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new SelectField({ name: 'accountKind', maxSelect: 1, values: KINDS }));
    users.fields.add(new TextField({ name: 'publicName', max: 60 }));
    app.save(users);

    const requests = new Collection({
      type: 'base',
      name: 'verification_requests',
      listRule: 'user = @request.auth.id',
      viewRule: 'user = @request.auth.id',
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      // Only superusers review a request.
      updateRule: null,
      deleteRule: "user = @request.auth.id && status = 'pending'",
      fields: [
        {
          type: 'relation',
          name: 'user',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'select', name: 'kind', required: true, maxSelect: 1, values: KINDS },
        { type: 'text', name: 'publicName', required: true, min: 3, max: 60, presentable: true },
        { type: 'text', name: 'about', required: true, max: 1000 },
        { type: 'text', name: 'links', max: 500 },
        {
          type: 'file',
          name: 'documents',
          maxSelect: 5,
          maxSize: 10 * 1024 * 1024,
          mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'],
          // Opening a file needs a file token, which only someone who can see the request gets.
          protected: true,
        },
        {
          type: 'select',
          name: 'status',
          required: true,
          maxSelect: 1,
          values: ['pending', 'approved', 'rejected', 'revoked', 'replaced'],
        },
        { type: 'text', name: 'reviewNote', max: 500 },
        { type: 'date', name: 'reviewedAt' },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        // One request in review per account.
        "CREATE UNIQUE INDEX idx_verification_requests_pending ON verification_requests (user) WHERE status = 'pending'",
        'CREATE INDEX idx_verification_requests_user ON verification_requests (user, created)',
        'CREATE INDEX idx_verification_requests_status ON verification_requests (status, created)',
      ],
    });
    app.save(requests);

    const notifications = app.findCollectionByNameOrId('notifications');
    const type = notifications.fields.getByName('type');
    type.values = [...type.values, ...NOTIFICATION_TYPES];
    app.save(notifications);
  },
  (app) => {
    const notifications = app.findCollectionByNameOrId('notifications');
    app
      .db()
      .newQuery(
        `DELETE FROM notifications WHERE type IN (${NOTIFICATION_TYPES.map((t) => `'${t}'`).join(', ')})`,
      )
      .execute();
    const type = notifications.fields.getByName('type');
    type.values = type.values.filter((value) => !NOTIFICATION_TYPES.includes(value));
    app.save(notifications);

    app.delete(app.findCollectionByNameOrId('verification_requests'));

    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('accountKind');
    users.fields.removeByName('publicName');
    app.save(users);
  },
);
