/// <reference path="../pb_data/types.d.ts" />

// Pawly health check. Confirms that the server is up and that the repository's
// migrations (app name) and hooks (this route) are loaded.
routerAdd('GET', '/api/pawly/health', (e) => {
  return e.json(200, {
    status: 'ok',
    app: $app.settings().meta.appName,
  });
});
