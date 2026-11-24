# Task 028: Forward nosniff in media proxy and guard media config bounds

GOAL: Forward `X-Content-Type-Options: nosniff` on binary proxy responses, reject non-object `body.media` with 400, and cap `media.retentionDays` (`<= 36500`) with an `Invalid Date` guard in `MediaCleanupJob`.
MODE: do
FILES: line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/jobs/MediaCleanupJob.ts
DONE-WHEN: `(cd line-kpi-system && npx tsc --noEmit) && (cd line-kpi-admin && npx tsc --noEmit && npm run lint)` exit 0, and runtime checks confirm `PUT /api/v1/config` returns 400 for `{ "media": null }` and `{ "media": { "retentionDays": 1000000000 } }`.
