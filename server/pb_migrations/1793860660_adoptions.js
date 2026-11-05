/// <reference path="../pb_data/types.d.ts" />

// Adoption listings: one of the publisher's pets put up for adoption, with the data people
// need to decide (sex, size, vaccines, spay/neuter, health, approximate zone, requirements),
// a description and up to 10 photos or videos. Species, breed and age come from the pet.
// Anyone can see them; only the publisher creates, edits and deletes them. A pet has at most
// one available listing, and the status only changes on the server (pb_hooks/adoptions.pb.js).
// Deleting the publisher's account or the pet deletes the listing.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const pets = app.findCollectionByNameOrId('pets');

    const adoptions = new Collection({
      type: 'base',
      name: 'adoptions',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.publisher = @request.auth.id",
      updateRule:
        'publisher = @request.auth.id && (@request.body.publisher:isset = false || @request.body.publisher = @request.auth.id)',
      deleteRule: 'publisher = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'publisher',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'relation',
          name: 'pet',
          required: true,
          collectionId: pets.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { type: 'select', name: 'sex', required: true, maxSelect: 1, values: ['female', 'male'] },
        {
          type: 'select',
          name: 'size',
          required: true,
          maxSelect: 1,
          values: ['small', 'medium', 'large'],
        },
        {
          type: 'select',
          name: 'vaccines',
          required: true,
          maxSelect: 1,
          values: ['complete', 'partial', 'none'],
        },
        { type: 'bool', name: 'sterilized' },
        { type: 'text', name: 'health', max: 500 },
        // Free text such as "Coyoacán, CDMX": the map provider is still open (stage 6).
        { type: 'text', name: 'zone', required: true, max: 80 },
        { type: 'text', name: 'requirements', max: 1000 },
        { type: 'text', name: 'description', max: 2200 },
        {
          type: 'file',
          name: 'media',
          maxSelect: 10,
          // Same limits as posts: videos up to 50 MB, photos up to 10 MB (checked in the hook).
          maxSize: 50 * 1024 * 1024,
          mimeTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'video/mp4',
            'video/quicktime',
          ],
          thumbs: ['300x300', '1080x0'],
        },
        {
          type: 'select',
          name: 'status',
          required: true,
          maxSelect: 1,
          values: ['available', 'adopted'],
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_adoptions_publisher ON adoptions (publisher)',
        'CREATE INDEX idx_adoptions_status_created ON adoptions (status, created)',
        "CREATE UNIQUE INDEX idx_adoptions_available_pet ON adoptions (pet) WHERE status = 'available'",
      ],
    });

    app.save(adoptions);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('adoptions'));
  },
);
