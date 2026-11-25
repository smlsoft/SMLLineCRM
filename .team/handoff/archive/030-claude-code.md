## claude-code · task 030 · CLAIMED

- **did:** claimed task 030 - `/api/proxy/*` in `line-kpi-admin` answers 401 without calling the backend when the request has no valid `auth-token` cookie, except `auth/*` paths, so the server-side API key is never used for an anonymous caller.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/api/proxy/[...path]/route.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/030-proxy-requires-login.md

## claude-code · task 030 · DONE

- **did:** `/api/proxy/*` returns 401 `Unauthorized: login required` before calling the backend unless the `auth-token` cookie verifies with `JWT_SECRET` (`line-kpi-admin/src/app/api/proxy/[...path]/route.ts:11`); `auth/*` paths stay open.
- **files touched:** line-kpi-admin/src/app/api/proxy/[...path]/route.ts
- **decided:** the gate sits in the proxy route, not in `line-kpi-admin/src/middleware.ts`, so page redirects are unchanged.
- **not checked:** production; per-permission checks on non-admin backend routes (a logged-in user without a permission can still call them through the proxy).
- **next:** none
