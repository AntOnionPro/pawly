/// <reference path="../pb_data/types.d.ts" />

// Adoption requests (stage 5): someone (`applicant`) asks to adopt the pet of a listing, with a
// presentation `message`. Only the applicant and the publisher see it. The server sets the
// `status` (pending, accepted, rejected or withdrawn) and checks every change
// (pb_hooks/adoption_requests.pb.js). One request per person and listing; requests are
// deleted with the listing and with the applicant's account.
//
// Notifications gain the adoption types (a new request for the publisher, an accepted or
// rejected request for the applicant) with the related `adoption`, and the push preferences
// gain `adoptionOff` for all of them.
migrate(
  (app) => {
    const adoptionTypes = ['adoption_request', 'request_accepted', 'request_rejected'];
    const users = app.findCollectionByNameOrId('users');
    const adoptions = app.findCollectionByNameOrId('adoptions');
    const participant = 'applicant = @request.auth.id || adoption.publisher = @request.auth.id';

    const requests = new Collection({
      type: 'base',
      name: 'adoption_requests',
      listRule: participant,
      viewRule: participant,
      createRule: "@request.auth.id != '' && @request.body.applicant = @request.auth.id",
      updateRule: participant,
      deleteRule: null,
      fields: [
        {
          type: 'relation',
          name: 'adoption',
          required: true,
          collectionId: adoptions.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'applicant',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'text', name: 'message', required: true, max: 1000 },
        {
          type: 'select',
          name: 'status',
          required: true,
          maxSelect: 1,
          values: ['pending', 'accepted', 'rejected', 'withdrawn'],
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_adoption_requests_unique ON adoption_requests (adoption, applicant)',
        'CREATE INDEX idx_adoption_requests_applicant ON adoption_requests (applicant, created)',
      ],
    });
    app.save(requests);

    const notifications = app.findCollectionByNameOrId('notifications');
    const type = notifications.fields.getByName('type');
    type.values = [...type.values, ...adoptionTypes];
    notifications.fields.add(
      new RelationField({
        name: 'adoption',
        collectionId: adoptions.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );
    app.save(notifications);

    const prefs = app.findCollectionByNameOrId('notification_prefs');
    prefs.fields.add(new BoolField({ name: 'adoptionOff' }));
    app.save(prefs);
  },
  (app) => {
    const adoptionTypes = ['adoption_request', 'request_accepted', 'request_rejected'];
    const prefs = app.findCollectionByNameOrId('notification_prefs');
    prefs.fields.removeByName('adoptionOff');
    app.save(prefs);

    const notifications = app.findCollectionByNameOrId('notifications');
    app
      .db()
      .newQuery(
        "DELETE FROM notifications WHERE type IN ('adoption_request', 'request_accepted', 'request_rejected')",
      )
      .execute();
    notifications.fields.removeByName('adoption');
    const type = notifications.fields.getByName('type');
    type.values = type.values.filter((value) => !adoptionTypes.includes(value));
    app.save(notifications);

    app.delete(app.findCollectionByNameOrId('adoption_requests'));
  },
);
