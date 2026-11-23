## claude-code · task 012 · CLAIMED

- **did:** claimed task 012 - An exception inside any async Express route (for example `GET /api/v1/messages?groupId=<not an ObjectId>`) becomes an HTTP error response and the backend process stays up; a bad id answers 400.
- **files touched:** none yet (claimed: line-kpi-system/src/api/asyncErrors.ts line-kpi-system/src/api/routes/groupMessageRoutes.ts line-kpi-system/src/app.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/012-async-route-errors.md

## claude-code · task 012 · DONE

- **did:** `line-kpi-system/src/api/asyncErrors.ts` makes every Express layer forward a rejected promise to `next(err)` (imported first in `line-kpi-system/src/app.ts`); the global error handler answers Mongoose `CastError` with 400 and skips when headers were sent; `unhandledRejection` is logged instead of ending the process; `GET /api/v1/messages` rejects a non-ObjectId `groupId` and an invalid `before` with 400.
- **files touched:** line-kpi-system/src/app.ts line-kpi-system/src/api/asyncErrors.ts line-kpi-system/src/api/routes/groupMessageRoutes.ts
- **decided:** one central fix (patching Express 4 `Layer`) instead of try/catch in 29 handlers or a new dependency.
- **not checked:** production; ESLint (the repo's lint config does not load with the current eslint). Verified against local MongoDB: unfixed code exited (`EXIT=1`) on `GET /api/v1/messages?groupId=C3aea5d9`; fixed code, built with `tsc` and run with `node` like the container, returned 400 for that call, `/health` 200 right after, 400 for `/employees/not-an-id` and `/conversations/not-an-id`, 400 for a bad `before`, a valid groupId still returned messages, process never exited.
- **next:** deploy the backend; the agent session then retests and installs its */5 crontab.
