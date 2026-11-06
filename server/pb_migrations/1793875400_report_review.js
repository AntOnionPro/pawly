/// <reference path="../pb_data/types.d.ts" />

// Report review (stage 7).
// - reports: adoption listings and rescue reports can be reported too. Each report keeps what
//   was reported (`targetKind`, `targetId`, `targetAuthor`, `targetText`) so it stays in the
//   history after the content is deleted, and has a `status` (pending, actioned, dismissed)
//   that superusers change in the admin panel. pb_hooks/moderation.pb.js fills the copy and
//   acts on the review.
//   Reports are no longer deleted with the content or with the account of whoever reported:
//   the relation is just emptied. They are deleted with the account of whoever was reported
//   (`targetAuthor`).
// - moderation_queue: a view with one row per reported content that has pending reports.
// - notifications: `content_removed` (to the author), `report_actioned` and `report_dismissed`
//   (to whoever reported) come from Pawly, so `actor` is no longer required. `contentKind` and
//   `reportReason` say what was removed and why.
const KINDS = ['post', 'comment', 'user', 'message', 'adoption', 'rescue'];
const CONTENT_COLLECTIONS = {
  post: ['posts', 'author', 'text'],
  comment: ['comments', 'author', 'text'],
  message: ['messages', 'sender', 'text'],
  adoption: ['adoptions', 'publisher', 'description'],
  rescue: ['rescue_reports', 'reporter', 'description'],
};
const TEXT_MAX = 2200;
const NOTIFICATION_TYPES = ['content_removed', 'report_actioned', 'report_dismissed'];

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    const reports = app.findCollectionByNameOrId('reports');

    reports.fields.add(
      new RelationField({
        name: 'adoption',
        collectionId: app.findCollectionByNameOrId('adoptions').id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    reports.fields.add(
      new RelationField({
        name: 'rescue',
        collectionId: app.findCollectionByNameOrId('rescue_reports').id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    for (const name of ['post', 'comment', 'user', 'message']) {
      reports.fields.getByName(name).cascadeDelete = false;
    }
    const reporter = reports.fields.getByName('reporter');
    reporter.required = false;
    reporter.cascadeDelete = false;

    reports.fields.add(new SelectField({ name: 'targetKind', maxSelect: 1, values: KINDS }));
    reports.fields.add(new TextField({ name: 'targetId', max: 15 }));
    reports.fields.add(
      new RelationField({
        name: 'targetAuthor',
        collectionId: users.id,
        cascadeDelete: true,
        maxSelect: 1,
      }),
    );
    reports.fields.add(new TextField({ name: 'targetText', max: TEXT_MAX }));
    reports.fields.add(
      new SelectField({
        name: 'status',
        maxSelect: 1,
        values: ['pending', 'actioned', 'dismissed'],
      }),
    );
    reports.fields.add(new DateField({ name: 'reviewedAt' }));
    reports.fields.add(new TextField({ name: 'reviewNote', max: 1000 }));

    // One report per person and thing. A report whose reporter or target was deleted (empty)
    // does not count, so emptying them never clashes.
    reports.indexes = [
      ...KINDS.map(
        (kind) =>
          `CREATE UNIQUE INDEX idx_reports_${kind} ON reports (reporter, ${kind}) WHERE ${kind} != '' AND reporter != ''`,
      ),
      'CREATE INDEX idx_reports_target ON reports (targetKind, targetId, status)',
      'CREATE INDEX idx_reports_status ON reports (status, created)',
    ];
    app.save(reports);

    // The reports made before this migration get their copy and the pending status.
    for (const record of app.findAllRecords('reports')) {
      const kind = KINDS.find((name) => record.getString(name) !== '');
      if (!kind) continue;
      const id = record.getString(kind);
      let author = '';
      let text = '';
      try {
        if (kind === 'user') {
          const user = app.findRecordById('users', id);
          author = user.id;
          text = `@${user.getString('username')}\n${user.getString('bio')}`.trim();
        } else {
          const [collection, authorField, textField] = CONTENT_COLLECTIONS[kind];
          const content = app.findRecordById(collection, id);
          author = content.getString(authorField);
          text = content.getString(textField);
        }
      } catch {
        // Not found: the report keeps no copy.
      }
      record.set('targetKind', kind);
      record.set('targetId', id);
      record.set('targetAuthor', author);
      record.set('targetText', text.slice(0, TEXT_MAX));
      record.set('status', 'pending');
      app.save(record);
    }

    const queue = new Collection({
      type: 'view',
      name: 'moderation_queue',
      listRule: null,
      viewRule: null,
      viewQuery: `
        SELECT
          (r.targetKind || '_' || r.targetId) AS id,
          r.targetKind AS kind,
          r.targetId AS target,
          r.targetAuthor AS author,
          COUNT(*) AS pending,
          GROUP_CONCAT(DISTINCT r.reason) AS reasons,
          (SELECT r2.targetText FROM reports r2
            WHERE r2.targetKind = r.targetKind AND r2.targetId = r.targetId
            ORDER BY r2.created DESC LIMIT 1) AS text,
          MIN(r.created) AS firstReport,
          MAX(r.created) AS lastReport
        FROM reports r
        WHERE r.status = 'pending' AND r.targetId != ''
        GROUP BY r.targetKind, r.targetId
      `,
    });
    app.save(queue);

    const notifications = app.findCollectionByNameOrId('notifications');
    notifications.fields.getByName('actor').required = false;
    const type = notifications.fields.getByName('type');
    type.values = [...type.values, ...NOTIFICATION_TYPES];
    notifications.fields.add(
      new SelectField({
        name: 'contentKind',
        maxSelect: 1,
        values: KINDS,
      }),
    );
    notifications.fields.add(
      new SelectField({
        name: 'reportReason',
        maxSelect: 1,
        values: reports.fields.getByName('reason').values,
      }),
    );
    app.save(notifications);
  },
  (app) => {
    const notifications = app.findCollectionByNameOrId('notifications');
    app
      .db()
      .newQuery(
        `DELETE FROM notifications WHERE type IN (${NOTIFICATION_TYPES.map((t) => `'${t}'`).join(', ')})`,
      )
      .execute();
    notifications.fields.removeByName('contentKind');
    notifications.fields.removeByName('reportReason');
    const type = notifications.fields.getByName('type');
    type.values = type.values.filter((value) => !NOTIFICATION_TYPES.includes(value));
    notifications.fields.getByName('actor').required = true;
    app.save(notifications);

    app.delete(app.findCollectionByNameOrId('moderation_queue'));

    const reports = app.findCollectionByNameOrId('reports');
    // Reports that only make sense with the new fields go away.
    app
      .db()
      .newQuery(
        "DELETE FROM reports WHERE adoption != '' OR rescue != '' OR reporter = '' OR (post = '' AND comment = '' AND user = '' AND message = '')",
      )
      .execute();
    for (const name of [
      'adoption',
      'rescue',
      'targetKind',
      'targetId',
      'targetAuthor',
      'targetText',
      'status',
      'reviewedAt',
      'reviewNote',
    ]) {
      reports.fields.removeByName(name);
    }
    for (const name of ['post', 'comment', 'user', 'message']) {
      reports.fields.getByName(name).cascadeDelete = true;
    }
    const reporter = reports.fields.getByName('reporter');
    reporter.required = true;
    reporter.cascadeDelete = true;
    reports.indexes = ['post', 'comment', 'user', 'message'].map(
      (kind) =>
        `CREATE UNIQUE INDEX idx_reports_${kind} ON reports (reporter, ${kind}) WHERE ${kind} != ''`,
    );
    app.save(reports);
  },
);
