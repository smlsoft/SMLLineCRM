## antigravity · task 026 · CLAIMED

- **did:** claimed task 026 - Add configurable MinIO S3-compatible media storage (with authenticated backend proxy for private buckets) and daily image retention cleanup (default 7 days) configurable on `/settings`.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/monitor/page.tsx line-kpi-admin/src/app/(dashboard)/settings/page.tsx line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-admin/src/lib/api.ts line-kpi-admin/src/types/api.ts line-kpi-system/src/api/router.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/api/routes/mediaRoutes.ts line-kpi-system/src/config/index.ts line-kpi-system/src/jobs/MediaCleanupJob.ts line-kpi-system/src/jobs/scheduler.ts line-kpi-system/src/models/MessageMedia.ts line-kpi-system/src/models/SystemConfig.ts line-kpi-system/src/services/ImageFetchService.ts line-kpi-system/src/services/MediaStorageClient.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/026-minio-media-storage-and-retention.md

## antigravity · task 026 · DONE

- **did:** Added configurable MinIO media storage (`SystemConfig.media.minio` and `MediaStorageClient.ts`), authenticated media proxy (`GET /api/v1/media/:id` and binary passthrough in `line-kpi-admin/src/app/api/proxy/[...path]/route.ts`), daily media retention cleanup job (`MediaCleanupJob` at `0 3 * * *` default 7 days plus `POST /api/v1/config/cleanup-media`), `/settings` UI for MinIO credentials and retention days, and `url` rendering on `/monitor`.
- **files touched:** line-kpi-system/src/config/index.ts line-kpi-system/src/models/SystemConfig.ts line-kpi-system/src/models/MessageMedia.ts line-kpi-system/src/services/MediaStorageClient.ts line-kpi-system/src/services/ImageFetchService.ts line-kpi-system/src/jobs/MediaCleanupJob.ts line-kpi-system/src/jobs/scheduler.ts line-kpi-system/src/api/routes/mediaRoutes.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/api/router.ts line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-admin/src/types/api.ts line-kpi-admin/src/lib/api.ts line-kpi-admin/src/app/(dashboard)/settings/page.tsx line-kpi-admin/src/app/(dashboard)/monitor/page.tsx
- **decided:** Default empty `publicUrl` on cloud/MinIO uploads to `/api/proxy/media/:id` behind `jwtAuth` + `X-API-Key` so private buckets render in `line-kpi-admin` without exposing bucket read access publicly.
- **not checked:** Live MongoDB config persistence, live LINE webhook image upload (`PutObject`), `MediaCleanupJob` deletion against a real database/bucket, `/settings` and `/monitor` rendering in a browser, and `line-kpi-mcp/` checks (`line-kpi-mcp/node_modules` is absent locally).
- **next:** start at line-kpi-admin/src/app/(dashboard)/settings/page.tsx:780 - configure MinIO credentials in `/settings` and click "ทดสอบการเชื่อมต่อ"
