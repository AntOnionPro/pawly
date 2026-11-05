/// <reference path="../pb_data/types.d.ts" />

// Pet profiles. Anyone can see them; only the owner creates, edits and deletes them.
// Deleting the owner's account deletes their pets (cascade).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const pets = new Collection({
      type: 'base',
      name: 'pets',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.owner = @request.auth.id",
      // The owner cannot hand the pet to someone else here (adoption transfers come in stage 5).
      updateRule:
        'owner = @request.auth.id && (@request.body.owner:isset = false || @request.body.owner = @request.auth.id)',
      deleteRule: 'owner = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'owner',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'text', name: 'name', required: true, min: 1, max: 40, presentable: true },
        {
          type: 'select',
          name: 'species',
          required: true,
          maxSelect: 1,
          values: ['dog', 'cat', 'bird', 'rabbit', 'rodent', 'reptile', 'fish', 'other'],
        },
        { type: 'text', name: 'breed', max: 60 },
        // Approximate birth date, used to show the age.
        { type: 'date', name: 'birthDate' },
        {
          type: 'file',
          name: 'photo',
          maxSelect: 1,
          maxSize: 5 * 1024 * 1024,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
          thumbs: ['100x100', '400x400'],
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_pets_owner ON pets (owner)'],
    });

    app.save(pets);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('pets'));
  },
);
