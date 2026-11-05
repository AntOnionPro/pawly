/// <reference path="../pb_data/types.d.ts" />

// Completing an adoption (stage 5). The publisher marks the listing as adopted by someone whose
// request they accepted (POST /api/pawly/adoptions/{id}/adopt, pb_hooks/adoptions.pb.js):
// - the listing keeps who adopted the pet (`adopter`) and when (`adoptedAt`), and an adopted
//   listing can no longer be deleted by the publisher (it is part of the pet's history);
// - the pet moves to the adopter, and keeps who had it before (`previousOwner`) and when it
//   was adopted (`adoptedAt`); only the server sets these;
// - the adopter gets an `adopted` notification.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const adoptions = app.findCollectionByNameOrId('adoptions');
    adoptions.fields.add(
      new RelationField({
        name: 'adopter',
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    adoptions.fields.add(new DateField({ name: 'adoptedAt' }));
    adoptions.deleteRule = "publisher = @request.auth.id && status = 'available'";
    app.save(adoptions);

    const pets = app.findCollectionByNameOrId('pets');
    pets.fields.add(
      new RelationField({
        name: 'previousOwner',
        collectionId: users.id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    pets.fields.add(new DateField({ name: 'adoptedAt' }));
    app.save(pets);

    const notifications = app.findCollectionByNameOrId('notifications');
    const type = notifications.fields.getByName('type');
    type.values = [...type.values, 'adopted'];
    app.save(notifications);
  },
  (app) => {
    const notifications = app.findCollectionByNameOrId('notifications');
    app.db().newQuery("DELETE FROM notifications WHERE type = 'adopted'").execute();
    const type = notifications.fields.getByName('type');
    type.values = type.values.filter((value) => value !== 'adopted');
    app.save(notifications);

    const pets = app.findCollectionByNameOrId('pets');
    pets.fields.removeByName('previousOwner');
    pets.fields.removeByName('adoptedAt');
    app.save(pets);

    const adoptions = app.findCollectionByNameOrId('adoptions');
    adoptions.fields.removeByName('adopter');
    adoptions.fields.removeByName('adoptedAt');
    adoptions.deleteRule = 'publisher = @request.auth.id';
    app.save(adoptions);
  },
);
