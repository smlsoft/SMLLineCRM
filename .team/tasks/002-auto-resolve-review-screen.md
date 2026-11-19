# Task 002: Auto-resolve review queue, permanent audit log, and API

GOAL: Add AutoResolveLog model, review/auto mode toggle, staleness-safe agent/admin APIs, RBAC permission wiring, and the /auto-resolve dashboard page for reviewing Layer 1/2 suggestions and auditing decisions.
MODE: do
FILES: line-kpi-system/src/models/AutoResolveLog.ts line-kpi-system/src/models/SystemConfig.ts line-kpi-system/src/models/PermissionGroup.ts line-kpi-system/src/processors/MetricsUpdater.ts line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-system/src/api/router.ts line-kpi-admin/src/types/api.ts line-kpi-admin/src/middleware.ts line-kpi-admin/src/components/Sidebar.tsx line-kpi-admin/src/lib/api.ts line-kpi-admin/src/app/(dashboard)/auto-resolve/
DONE-WHEN: (cd line-kpi-system && npx tsc --noEmit) && (cd line-kpi-admin && npx tsc --noEmit && npm run lint) exits 0 with zero errors and all 5 permission locations include auto-resolve

## Notes
- Next.js proxy (`line-kpi-admin/src/app/api/proxy/[...path]/route.ts:13`) forwards JWT Authorization ONLY for paths starting with `admin/`. Therefore agent endpoints mount at `/api/v1/auto-resolve` (API key only) and admin UI endpoints mount at `/api/v1/admin/auto-resolve` (API key + JWT + `requirePermission('auto-resolve')`).
- Do not touch `.env`, `.env.local`, `line-kpi-system/dist/`, or `line-kpi-admin/.next/`.
