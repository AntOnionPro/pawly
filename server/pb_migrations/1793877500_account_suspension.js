/// <reference path="../pb_data/types.d.ts" />

// Account suspension (stage 7). Superusers suspend an account from the admin panel until a
// date (`suspendedUntil`) or for good (`suspendedForever`), with a `suspensionReason` the
// person sees when signing in. The fields are hidden, so only superusers see and change them.
// The effects live in pb_hooks/suspension.pb.js.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new DateField({ name: 'suspendedUntil', hidden: true }));
    users.fields.add(new BoolField({ name: 'suspendedForever', hidden: true }));
    users.fields.add(new TextField({ name: 'suspensionReason', max: 300, hidden: true }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['suspendedUntil', 'suspendedForever', 'suspensionReason']) {
      users.fields.removeByName(name);
    }
    app.save(users);
  },
);
