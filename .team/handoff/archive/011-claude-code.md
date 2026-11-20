## claude-code · task 011 · CLAIMED

- **did:** claimed task 011 - `/auto-resolve` lists the same "รอ AI ตรวจ" / "ยังไม่ได้ตอบ" rooms that `/monitor` badges, and the refresh button on both pages runs one Layer 1 pass immediately (no 30-minute wait) before reloading, showing a short summary.
- **files touched:** none yet (claimed: docker-compose.yml line-kpi-admin/src/app/(dashboard)/auto-resolve/ line-kpi-admin/src/app/(dashboard)/monitor/ line-kpi-admin/src/lib/api.ts line-kpi-admin/src/types/api.ts line-kpi-mcp/Dockerfile line-kpi-mcp/README.md line-kpi-mcp/src/worker/ line-kpi-mcp/test/ line-kpi-system/src/api/router.ts line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-system/src/api/routes/layer1Routes.ts line-kpi-system/src/config/index.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/011-ai-queue-tab-and-check-now.md

## claude-code · task 011 · DONE

- **did:** worker (`line-kpi-mcp/src/worker/trigger.ts`, `run-layer1.ts`) listens on `TRIGGER_PORT` 3005 in loop mode: `POST /run` starts a background pass or joins the running one (202), `GET /status` reports it; both need `X-API-Key`; timer and triggers share one pass. Backend `line-kpi-system/src/api/routes/layer1Routes.ts` (`/api/v1/admin/layer1/check-now`, `/status`, JWT + `monitor` or `auto-resolve` permission, 503 if `LAYER1_WORKER_URL` unset) and `GET /api/v1/admin/auto-resolve/queue` (same filter and snapshot match as monitor's `attachTriageStatus`). Admin: refresh on `/monitor` and `/auto-resolve` runs the check in the background with a banner and summary (`line-kpi-admin/src/components/Layer1Check.tsx`); `/auto-resolve` has a "รอ AI ตรวจ" tab (`AiQueueList.tsx`). Compose: backend `LAYER1_WORKER_URL`, worker `TRIGGER_PORT`.
- **files touched:** see FILES in the task.
- **decided:** user asked for background checking so a large number of rooms never blocks the page; the 30 s auto refresh only reloads data.
- **not checked:** production (needs `LAYER1_WORKER_URL=http://worker:3005` on the backend and the new worker image); dark mode. Verified on local MongoDB `line_kpi_local` with backend, worker (tsx) and admin running: Monitor refresh → worker pass at that moment, banner "กำลังตรวจเบื้องหลัง…" then "ตรวจเสร็จ · …ส่งให้ AI 1" after 2 s, tabs stayed usable; Auto-Resolve refresh same; 3 concurrent triggers → 1 pass; worker `/run` without key → 401; AI tab listed 7 rooms = the 7 rooms `/monitor` badged. Test rows deleted; 25/25 worker tests pass.
- **next:** on the server add `LAYER1_WORKER_URL=http://worker:3005` to the backend environment and pull backend, admin and worker.
