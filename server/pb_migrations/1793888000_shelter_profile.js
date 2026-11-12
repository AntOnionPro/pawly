/// <reference path="../pb_data/types.d.ts" />

// Profile of a shelter or rescuer (stage 10): where it is, when it attends and what it needs.
// The fields live on `users`, are public, and only a verified account (`accountKind`) can fill
// them in (pb_hooks/accounts.pb.js); taking the verification back empties them
// (pb_hooks/verification.pb.js).
// - `zone`: the area or the address, in text.
// - `latitude`, `longitude`: an optional point on the map (both 0 when there is none), since
//   many shelters do not publish their exact address.
// - `hours`: opening hours, in text.
// - `needs`: what it needs, and `needsNote` with the details.
const NEEDS = ['food', 'medicine', 'blankets', 'volunteers', 'foster', 'transport', 'other'];

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.fields.add(new TextField({ name: 'zone', max: 120 }));
    users.fields.add(new NumberField({ name: 'latitude', min: -90, max: 90 }));
    users.fields.add(new NumberField({ name: 'longitude', min: -180, max: 180 }));
    users.fields.add(new TextField({ name: 'hours', max: 200 }));
    users.fields.add(new SelectField({ name: 'needs', maxSelect: NEEDS.length, values: NEEDS }));
    users.fields.add(new TextField({ name: 'needsNote', max: 300 }));
    app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    for (const name of ['zone', 'latitude', 'longitude', 'hours', 'needs', 'needsNote']) {
      users.fields.removeByName(name);
    }
    app.save(users);
  },
);
