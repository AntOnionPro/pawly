/// <reference path="../pb_data/types.d.ts" />

// "I can help" (stage 6). `rescue_helpers` holds the people (`helper`) who offered to help with
// a rescue report of an animal that needs help, with an optional `message`. One offer per
// person and report; the helper withdraws it by deleting it, and nobody edits it. Only the
// helper and the reporter see an offer; everyone sees how many there are in the report's
// `helperCount`, which only the server writes (pb_hooks/counters.pb.js). The first offer moves
// an open report to in progress, and the reporter gets a `rescue_help` notification, with the
// related `rescue` report. The push preferences gain `rescueOff`.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const reports = app.findCollectionByNameOrId('rescue_reports');

    const helpers = new Collection({
      type: 'base',
      name: 'rescue_helpers',
      listRule: 'helper = @request.auth.id || report.reporter = @request.auth.id',
      viewRule: 'helper = @request.auth.id || report.reporter = @request.auth.id',
      createRule: "@request.auth.id != '' && @request.body.helper = @request.auth.id",
      updateRule: null,
      deleteRule: 'helper = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'report',
          required: true,
          collectionId: reports.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'helper',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'text', name: 'message', max: 500 },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_rescue_helpers_unique ON rescue_helpers (report, helper)',
      ],
    });
    app.save(helpers);

    reports.fields.add(new NumberField({ name: 'helperCount', min: 0, onlyInt: true }));
    app.save(reports);

    const notifications = app.findCollectionByNameOrId('notifications');
    const type = notifications.fields.getByName('type');
    type.values = [...type.values, 'rescue_help'];
    notifications.fields.add(
      new RelationField({
        name: 'rescue',
        collectionId: reports.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );
    app.save(notifications);

    const prefs = app.findCollectionByNameOrId('notification_prefs');
    prefs.fields.add(new BoolField({ name: 'rescueOff' }));
    app.save(prefs);
  },
  (app) => {
    const prefs = app.findCollectionByNameOrId('notification_prefs');
    prefs.fields.removeByName('rescueOff');
    app.save(prefs);

    const notifications = app.findCollectionByNameOrId('notifications');
    app.db().newQuery("DELETE FROM notifications WHERE type = 'rescue_help'").execute();
    notifications.fields.removeByName('rescue');
    const type = notifications.fields.getByName('type');
    type.values = type.values.filter((value) => value !== 'rescue_help');
    app.save(notifications);

    const reports = app.findCollectionByNameOrId('rescue_reports');
    reports.fields.removeByName('helperCount');
    app.save(reports);

    app.delete(app.findCollectionByNameOrId('rescue_helpers'));
  },
);
