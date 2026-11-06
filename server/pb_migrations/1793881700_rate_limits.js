/// <reference path="../pb_data/types.d.ts" />

// Limits against spam (stage 7).
// - PocketBase's rate limiter, per connection (IP address), only for signing in, signing up and
//   the emails people can ask for. Behind Cloudflare Tunnel (stage 8) the real address comes in
//   `CF-Connecting-IP`. The limits are generous because many phones can share one address
//   (mobile networks). Superusers can change them in the admin panel (Settings → Rate limits).
//   PAWLY_LIMITS=off leaves the limiter off (the tests do, since they sign in many times).
// - conversations: `startedBy` (set by the server) says who started each one, for its limit.
// - Indexes so the per-account limits (pb_hooks/limits.pb.js) count records quickly.
const RULES = [
  { label: '*:auth', audience: '', duration: 60, maxRequests: 20 },
  { label: 'users:create', audience: '', duration: 3600, maxRequests: 10 },
  { label: '*:requestPasswordReset', audience: '', duration: 3600, maxRequests: 10 },
  { label: '*:requestVerification', audience: '', duration: 3600, maxRequests: 10 },
  { label: '*:requestOTP', audience: '', duration: 3600, maxRequests: 10 },
];
const INDEXES = {
  posts: ['idx_posts_author_created', 'author'],
  comments: ['idx_comments_author_created', 'author'],
  messages: ['idx_messages_sender_created', 'sender'],
  conversations: ['idx_conversations_started', 'startedBy'],
  follows: ['idx_follows_follower_created', 'follower'],
  reports: ['idx_reports_reporter_created', 'reporter'],
  adoptions: ['idx_adoptions_publisher_created', 'publisher'],
  rescue_reports: ['idx_rescue_reports_reporter_created', 'reporter'],
  rescue_helpers: ['idx_rescue_helpers_helper_created', 'helper'],
};

migrate(
  (app) => {
    const settings = app.settings();
    settings.rateLimits.enabled = $os.getenv('PAWLY_LIMITS') !== 'off';
    settings.rateLimits.rules = RULES;
    settings.trustedProxy.headers = ['CF-Connecting-IP'];
    app.save(settings);

    const conversations = app.findCollectionByNameOrId('conversations');
    conversations.fields.add(
      new RelationField({
        name: 'startedBy',
        collectionId: app.findCollectionByNameOrId('users').id,
        cascadeDelete: false,
        maxSelect: 1,
      }),
    );
    app.save(conversations);

    for (const [name, [index, owner]] of Object.entries(INDEXES)) {
      const collection = app.findCollectionByNameOrId(name);
      collection.addIndex(index, false, `${owner}, created`, '');
      app.save(collection);
    }
  },
  (app) => {
    for (const [name, [index]] of Object.entries(INDEXES)) {
      const collection = app.findCollectionByNameOrId(name);
      collection.removeIndex(index);
      app.save(collection);
    }
    const conversations = app.findCollectionByNameOrId('conversations');
    conversations.fields.removeByName('startedBy');
    app.save(conversations);

    const settings = app.settings();
    settings.rateLimits.enabled = false;
    settings.rateLimits.rules = [];
    settings.trustedProxy.headers = [];
    app.save(settings);
  },
);
