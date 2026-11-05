/// <reference path="../pb_data/types.d.ts" />

// Follow-up after an adoption (stage 5). `adoption_followups` holds four follow-ups per
// adopted listing (`milestone`: week1, month1, month3 or month6, due at `dueAt`), the post that
// counted as its update (`post`) and when the adopter was reminded (`remindedAt`). Only the
// server creates and changes them (pb_hooks/followups.pb.js); only the adopter and the previous
// owner see them. They are deleted with the listing.
//
// Notifications gain `followup_due` (a reminder for the adopter) and `followup_posted` (an
// update for the previous owner), with the related `followup`. Reports gain the reason
// `adoption_followup`. Listings adopted before this migration get their follow-ups too.
migrate(
  (app) => {
    const adoptions = app.findCollectionByNameOrId('adoptions');
    const posts = app.findCollectionByNameOrId('posts');
    const shared = 'adoption.adopter = @request.auth.id || adoption.publisher = @request.auth.id';

    const followups = new Collection({
      type: 'base',
      name: 'adoption_followups',
      listRule: shared,
      viewRule: shared,
      createRule: null,
      updateRule: null,
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
          type: 'select',
          name: 'milestone',
          required: true,
          maxSelect: 1,
          values: ['week1', 'month1', 'month3', 'month6'],
        },
        { type: 'date', name: 'dueAt', required: true },
        {
          type: 'relation',
          name: 'post',
          collectionId: posts.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { type: 'date', name: 'remindedAt' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_adoption_followups_milestone ON adoption_followups (adoption, milestone)',
        'CREATE INDEX idx_adoption_followups_due ON adoption_followups (dueAt)',
      ],
    });
    app.save(followups);

    const notifications = app.findCollectionByNameOrId('notifications');
    const type = notifications.fields.getByName('type');
    type.values = [...type.values, 'followup_due', 'followup_posted'];
    notifications.fields.add(
      new RelationField({
        name: 'followup',
        collectionId: followups.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );
    app.save(notifications);

    const reports = app.findCollectionByNameOrId('reports');
    const reason = reports.fields.getByName('reason');
    reason.values = [...reason.values, 'adoption_followup'];
    app.save(reports);

    // Same milestones as pb_hooks/lib/followups.js.
    const day = 24 * 60 * 60 * 1000;
    const milestones = [
      ['week1', 7],
      ['month1', 30],
      ['month3', 90],
      ['month6', 180],
    ];
    const adopted = app.findRecordsByFilter('adoptions', "status = 'adopted' && adoptedAt != ''");
    for (const adoption of adopted) {
      const start = new Date(adoption.getString('adoptedAt').replace(' ', 'T')).getTime();
      for (const [name, days] of milestones) {
        const record = new Record(followups);
        record.set('adoption', adoption.id);
        record.set('milestone', name);
        record.set('dueAt', new Date(start + days * day).toISOString().replace('T', ' '));
        app.save(record);
      }
    }
  },
  (app) => {
    const reports = app.findCollectionByNameOrId('reports');
    app.db().newQuery("DELETE FROM reports WHERE reason = 'adoption_followup'").execute();
    const reason = reports.fields.getByName('reason');
    reason.values = reason.values.filter((value) => value !== 'adoption_followup');
    app.save(reports);

    const notifications = app.findCollectionByNameOrId('notifications');
    app
      .db()
      .newQuery("DELETE FROM notifications WHERE type IN ('followup_due', 'followup_posted')")
      .execute();
    notifications.fields.removeByName('followup');
    const type = notifications.fields.getByName('type');
    type.values = type.values.filter(
      (value) => value !== 'followup_due' && value !== 'followup_posted',
    );
    app.save(notifications);

    app.delete(app.findCollectionByNameOrId('adoption_followups'));
  },
);
