## antigravity · task 027 · CLAIMED

- **did:** claimed task 027 - Fix PR #26 review findings by enforcing JWT + `settings` permission on `/api/v1/config`, strictly validating `media.retentionDays`, adding `nosniff` and stream cleanup on client abort in `mediaRoutes`, excluding failed storage clients in `MediaCleanupJob` queries, and guarding `/settings` manual cleanup against unsaved `retentionDays`.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/settings/page.tsx line-kpi-system/src/api/router.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/api/routes/mediaRoutes.ts line-kpi-system/src/jobs/MediaCleanupJob.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/027-minio-review-fixes.md

## antigravity · task 027 · DONE

- **did:** Enforced `jwtAuth` + `requirePermission('settings')` on `/api/v1/config` (`line-kpi-system/src/api/router.ts:37`), tightened `media.retentionDays` validation (`line-kpi-system/src/api/routes/configRoutes.ts:202-218`), added `X-Content-Type-Options: nosniff` and `res.on('close')` stream cleanup (`line-kpi-system/src/api/routes/mediaRoutes.ts:41,64,71-75`), excluded `failedClientStorages` in `MediaCleanupJob` queries (`line-kpi-system/src/jobs/MediaCleanupJob.ts:62-64`), and disabled the `/settings` manual cleanup button while `retentionDays` has unsaved changes (`line-kpi-admin/src/app/(dashboard)/settings/page.tsx:1042-1057`).
- **files touched:** line-kpi-system/src/api/router.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/api/routes/mediaRoutes.ts line-kpi-system/src/jobs/MediaCleanupJob.ts line-kpi-admin/src/app/(dashboard)/settings/page.tsx
- **decided:** Require `settings` permission on `/api/v1/config` rather than allowing unauthenticated or read-only admin callers through the Next.js proxy.
- **not checked:** Live browser interaction on `/settings`, live MongoDB persistence, live S3 stream abort under load, and `line-kpi-mcp/` checks (`line-kpi-mcp/node_modules` absent locally).
- **next:** start at line-kpi-admin/src/app/(dashboard)/settings/page.tsx:780 - verify MinIO config and retention settings in browser after deploy
