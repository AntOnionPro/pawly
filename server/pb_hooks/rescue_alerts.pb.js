/// <reference path="../pb_data/types.d.ts" />

// Nearby rescue alerts. Each handler runs on its own, so shared code lives in lib/geo.js.

// An alert stores a location rounded to about 500 m (never the exact one), a radius the app
// offers, and a location that is not empty.
function validateAlert(e) {
  const { RADII, roundCoordinate } = require(`${__hooks}/lib/geo.js`);
  const record = e.record;
  const fail = (field, code, message) => {
    throw new BadRequestError('Invalid alert.', { [field]: new ValidationError(code, message) });
  };
  if (!RADII.includes(record.getInt('radiusKm'))) {
    fail('radiusKm', 'invalid_radius', 'Choose 1, 5, 10 or 25 km.');
  }
  if (record.getFloat('latitude') === 0 && record.getFloat('longitude') === 0) {
    fail('latitude', 'location_required', 'Add the location.');
  }
  record.set('latitude', roundCoordinate(record.getFloat('latitude')));
  record.set('longitude', roundCoordinate(record.getFloat('longitude')));
  e.next();
}

onRecordCreateRequest(validateAlert, 'rescue_alerts');
onRecordUpdateRequest(validateAlert, 'rescue_alerts');

// A new report alerts everyone whose radius includes it: never the reporter, nobody across a
// block, and each person once.
onRecordAfterCreateSuccess((e) => {
  e.next();
  const { boundingBox, distanceKm, formatKm } = require(`${__hooks}/lib/geo.js`);
  const { hasBlock } = require(`${__hooks}/lib/moderation.js`);
  const { notify } = require(`${__hooks}/lib/notifications.js`);
  try {
    const report = e.record;
    const reporter = report.getString('reporter');
    const point = {
      latitude: report.getFloat('latitude'),
      longitude: report.getFloat('longitude'),
    };
    // Alerts within the largest radius (25 km, plus the rounding); each is checked below.
    const box = boundingBox(point, 26);
    const alerts = e.app.findRecordsByFilter(
      'rescue_alerts',
      'user != {:reporter} && latitude >= {:minLat} && latitude <= {:maxLat} && ' +
        'longitude >= {:minLng} && longitude <= {:maxLng}',
      '',
      0,
      0,
      { reporter, ...box },
    );
    for (const alert of alerts) {
      const km = distanceKm(point, {
        latitude: alert.getFloat('latitude'),
        longitude: alert.getFloat('longitude'),
      });
      const recipient = alert.getString('user');
      if (km > alert.getInt('radiusKm') || hasBlock(e.app, recipient, reporter)) continue;
      notify(e.app, {
        recipient,
        actor: reporter,
        type: 'rescue_nearby',
        rescue: report.id,
        distanceKm: Number(formatKm(km)),
      });
    }
  } catch (error) {
    console.log(`[pawly-rescue] nearby alerts: ${error}`);
  }
}, 'rescue_reports');
