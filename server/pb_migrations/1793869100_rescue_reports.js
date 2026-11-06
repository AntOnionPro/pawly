/// <reference path="../pb_data/types.d.ts" />

// Rescue reports (stage 6): a stray animal that needs help, a lost pet or a found animal, with
// a description, up to 10 photos or videos and a GPS location (`latitude`, `longitude`, plus a
// `place` reference in text).
// - Needs help (`help`) has an `urgency` (low, medium or high).
// - Lost (`lost`) can point to one of the reporter's `pet`s and says when it was last seen
//   (`lastSeenAt`).
// - `status`: `open` (open, lost or found), `in_progress` (only for help) or `closed` (resolved
//   or reunited). A new report is always open.
// Anyone can see them; only the reporter creates, edits, changes the status and deletes them
// (pb_hooks/rescue.pb.js). Deleting the account deletes their reports.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const pets = app.findCollectionByNameOrId('pets');

    const reports = new Collection({
      type: 'base',
      name: 'rescue_reports',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.reporter = @request.auth.id",
      updateRule:
        'reporter = @request.auth.id && (@request.body.reporter:isset = false || @request.body.reporter = @request.auth.id)',
      deleteRule: 'reporter = @request.auth.id',
      fields: [
        {
          type: 'relation',
          name: 'reporter',
          required: true,
          collectionId: users.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          type: 'select',
          name: 'kind',
          required: true,
          maxSelect: 1,
          values: ['help', 'lost', 'found'],
        },
        { type: 'text', name: 'description', required: true, max: 2200 },
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
        { type: 'number', name: 'latitude', min: -90, max: 90 },
        { type: 'number', name: 'longitude', min: -180, max: 180 },
        { type: 'text', name: 'place', max: 120 },
        { type: 'select', name: 'urgency', maxSelect: 1, values: ['low', 'medium', 'high'] },
        {
          type: 'relation',
          name: 'pet',
          collectionId: pets.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { type: 'date', name: 'lastSeenAt' },
        {
          type: 'select',
          name: 'status',
          required: true,
          maxSelect: 1,
          values: ['open', 'in_progress', 'closed'],
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_rescue_reports_reporter ON rescue_reports (reporter)',
        'CREATE INDEX idx_rescue_reports_status_created ON rescue_reports (status, created)',
        'CREATE INDEX idx_rescue_reports_location ON rescue_reports (latitude, longitude)',
      ],
    });
    app.save(reports);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('rescue_reports'));
  },
);
