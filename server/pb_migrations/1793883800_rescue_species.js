/// <reference path="../pb_data/types.d.ts" />

// What animal a rescue report is about (stage 7.5): `species`, with the same values as pets.
// It is optional, so the reports saved before have none (the app shows the kind of case
// instead). A lost report that points to a pet takes the pet's species
// (pb_hooks/rescue.pb.js).
migrate(
  (app) => {
    const reports = app.findCollectionByNameOrId('rescue_reports');
    reports.fields.add(
      new SelectField({
        name: 'species',
        maxSelect: 1,
        values: ['dog', 'cat', 'bird', 'rabbit', 'rodent', 'reptile', 'fish', 'other'],
      }),
    );
    app.save(reports);
  },
  (app) => {
    const reports = app.findCollectionByNameOrId('rescue_reports');
    reports.fields.removeByName('species');
    app.save(reports);
  },
);
