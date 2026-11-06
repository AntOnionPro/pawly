/// <reference path="../pb_data/types.d.ts" />

// Nearby rescue alerts (stage 6). `rescue_alerts` holds, for each person who turned them on,
// an approximate location (`latitude`, `longitude`, rounded by the server to about 500 m) and
// the radius in km (`radiusKm`: 1, 5, 10 or 25). One per person; only its owner sees, changes
// and deletes it, and it goes away with the account. When someone creates a rescue report,
// everyone whose radius includes it gets a `rescue_nearby` notification
// (pb_hooks/rescue_alerts.pb.js), with how far it is in `distanceKm`.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const owner = 'user = @request.auth.id';
    const alerts = new Collection({
      type: 'base',
      name: 'rescue_alerts',
      listRule: owner,
      viewRule: owner,
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: `${owner} && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`,
      deleteRule: owner,
      fields: [
        {
          type: 'relation',
          name: 'user',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'number', name: 'latitude', min: -90, max: 90 },
        { type: 'number', name: 'longitude', min: -180, max: 180 },
        { type: 'number', name: 'radiusKm', required: true, onlyInt: true },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_rescue_alerts_user ON rescue_alerts (user)',
        'CREATE INDEX idx_rescue_alerts_location ON rescue_alerts (latitude, longitude)',
      ],
    });
    app.save(alerts);

    const notifications = app.findCollectionByNameOrId('notifications');
    const type = notifications.fields.getByName('type');
    type.values = [...type.values, 'rescue_nearby'];
    notifications.fields.add(new NumberField({ name: 'distanceKm', min: 0 }));
    app.save(notifications);
  },
  (app) => {
    const notifications = app.findCollectionByNameOrId('notifications');
    app.db().newQuery("DELETE FROM notifications WHERE type = 'rescue_nearby'").execute();
    notifications.fields.removeByName('distanceKm');
    const type = notifications.fields.getByName('type');
    type.values = type.values.filter((value) => value !== 'rescue_nearby');
    app.save(notifications);

    app.delete(app.findCollectionByNameOrId('rescue_alerts'));
  },
);
