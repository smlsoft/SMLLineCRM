# Task 012: A failing async API route answers an error instead of crashing the backend

GOAL: An exception inside any async Express route (for example `GET /api/v1/messages?groupId=<not an ObjectId>`) becomes an HTTP error response and the backend process stays up; a bad id answers 400.
MODE: do
FILES: line-kpi-system/src/app.ts line-kpi-system/src/api/asyncErrors.ts line-kpi-system/src/api/routes/groupMessageRoutes.ts
DONE-WHEN: (cd line-kpi-system && npx tsc --noEmit) exits 0, and against a LOCAL MongoDB: on the unfixed code `GET /api/v1/messages?groupId=C3aea5d9` kills the process (reproduced first); on the fixed code it returns 400, `GET /health` still answers 200 right after, a non-ObjectId `:id` on another async route without try/catch (e.g. `GET /api/v1/employees/not-an-id`) returns 400 instead of crashing, and a valid `groupId` still returns messages
## Notes
- Reported by the Layer 2 agent session: production went down (502 for 30-60 s) 3 times on 2026-11-23 from this call; the secretary profile's `get_group_messages` MCP tool can send such an id.
- Cause: Express 4 does not route async rejections to the error handler; `groupMessageRoutes.ts` has no try/catch; 29 async route handlers in `line-kpi-system/src/api/routes/` lack try/catch. Fix once for all routes (forward async rejections to `next`) instead of editing each handler; map Mongoose `CastError` to 400 in the global error handler; log `unhandledRejection` instead of dying.
- Not touched: `.env`, `dist/`, other routes' logic.
