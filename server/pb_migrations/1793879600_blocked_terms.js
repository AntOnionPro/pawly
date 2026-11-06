/// <reference path="../pb_data/types.d.ts" />

// Content filter (stage 7): `blocked_terms` holds the words and phrases the server checks in
// the texts people save (pb_hooks/content_filter.pb.js). A `block` term stops the save; a
// `review` term saves it and sends it to the moderation queue with its `reason`. Only
// superusers see and change the list, from the admin panel. Terms are compared without
// accents, case, repeated letters or common look-alikes, and only as whole words or phrases.
// This is a starting list; administrators add to it.
const STARTING_LIST = [
  // Serious insults and slurs (Spanish and English): they cannot be published.
  ...[
    'pendejo',
    'pendeja',
    'puto',
    'puta',
    'hijo de puta',
    'hija de puta',
    'chinga tu madre',
    'chingatumadre',
    'culero',
    'culera',
    'verga',
    'joto',
    'maricón',
    'mátate',
    'muérete',
    'fuck you',
    'motherfucker',
    'cunt',
    'faggot',
    'nigger',
    'retard',
    'kill yourself',
    'kys',
  ].map((term) => [term, 'block', 'offensive']),
  // Selling animals: saved, and sent to review.
  ...[
    'vendo',
    'se vende',
    'se venden',
    'en venta',
    'a la venta',
    'venta de',
    'for sale',
    'selling',
  ].map((term) => [term, 'review', 'animal_sale']),
  // Animal fights: saved, and sent to review.
  ...[
    'pelea de perros',
    'peleas de perros',
    'pelea de gallos',
    'peleas de gallos',
    'dog fight',
    'dogfight',
    'dogfighting',
  ].map((term) => [term, 'review', 'animal_abuse']),
];

migrate(
  (app) => {
    const terms = new Collection({
      type: 'base',
      name: 'blocked_terms',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { type: 'text', name: 'term', required: true, max: 100, presentable: true },
        {
          type: 'select',
          name: 'action',
          required: true,
          maxSelect: 1,
          values: ['block', 'review'],
        },
        {
          type: 'select',
          name: 'reason',
          maxSelect: 1,
          values: ['spam', 'offensive', 'animal_abuse', 'animal_sale', 'other'],
        },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_blocked_terms_term ON blocked_terms (term)'],
    });
    app.save(terms);

    for (const [term, action, reason] of STARTING_LIST) {
      const record = new Record(terms);
      record.set('term', term);
      record.set('action', action);
      record.set('reason', reason);
      app.save(record);
    }
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('blocked_terms'));
  },
);
