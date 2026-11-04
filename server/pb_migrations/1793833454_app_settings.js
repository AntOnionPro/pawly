/// <reference path="../pb_data/types.d.ts" />

// Names the app "Pawly" (shown in the admin panel and used as the sender of emails).
migrate(
  (app) => {
    const settings = app.settings();
    settings.meta.appName = 'Pawly';
    settings.meta.senderName = 'Pawly';
    app.save(settings);
  },
  (app) => {
    const settings = app.settings();
    settings.meta.appName = 'Acme';
    settings.meta.senderName = 'Support';
    app.save(settings);
  },
);
