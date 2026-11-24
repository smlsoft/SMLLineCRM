## antigravity · task 028 · CLAIMED

- **did:** claimed task 028 - Forward `X-Content-Type-Options: nosniff` on binary proxy responses, reject non-object `body.media` with 400, and cap `media.retentionDays` (`<= 36500`) with an `Invalid Date` guard in `MediaCleanupJob`.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/jobs/MediaCleanupJob.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/028-proxy-nosniff-and-config-guards.md

## antigravity · task 028 · DONE

- **did:** Forwarded `X-Content-Type-Options` (default `'nosniff'`) on binary responses in `line-kpi-admin/src/app/api/proxy/[...path]/route.ts:89`, guarded non-object `body.media` with 400 and capped `media.retentionDays <= 36500` in `line-kpi-system/src/api/routes/configRoutes.ts:195-219`, and added an `Invalid Date` guard in `line-kpi-system/src/jobs/MediaCleanupJob.ts:50-57`.
- **files touched:** line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-system/src/api/routes/configRoutes.ts line-kpi-system/src/jobs/MediaCleanupJob.ts
- **decided:** Cap `media.retentionDays` at 36500 (~100 years) so `Date.now() - retentionDays * 86400000` never overflows JS `Date`.
- **not checked:** Live browser response headers on `/api/proxy/media/:id`, live MongoDB persistence, and `line-kpi-mcp/` checks (`line-kpi-mcp/node_modules` absent locally).
- **next:** start at line-kpi-admin/src/app/(dashboard)/settings/page.tsx:780 - configure MinIO credentials and retention days on `/settings`
