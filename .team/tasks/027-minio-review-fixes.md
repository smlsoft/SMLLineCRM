# Task 027: Harden config auth, retentionDays validation, and media streaming

GOAL: Fix PR #26 review findings by enforcing JWT + `settings` permission on `/api/v1/config`, strictly validating `media.retentionDays`, adding `nosniff` and stream cleanup on client abort in `mediaRoutes`, excluding failed storage clients in `MediaCleanupJob` queries, and guarding `/settings` manual cleanup against unsaved `retentionDays`.
MODE: do
FILES: line-kpi-system/src/api/router.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/api/routes/mediaRoutes.ts line-kpi-system/src/jobs/MediaCleanupJob.ts line-kpi-admin/src/app/(dashboard)/settings/page.tsx
DONE-WHEN: `(cd line-kpi-system && npx tsc --noEmit) && (cd line-kpi-admin && npx tsc --noEmit && npm run lint)` exit 0, and runtime checks confirm `/api/v1/config` returns 401 without JWT, 403 without `settings` permission, and 200 with `settings` permission, while `PUT /api/v1/config` rejects `retentionDays: null | "" | false | []` with 400.
