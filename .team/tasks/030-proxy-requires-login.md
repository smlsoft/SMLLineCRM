# Task 030: Admin proxy refuses callers without a valid login

GOAL: `/api/proxy/*` in `line-kpi-admin` answers 401 without calling the backend when the request has no valid `auth-token` cookie, except `auth/*` paths, so the server-side API key is never used for an anonymous caller.
MODE: do
FILES: line-kpi-admin/src/app/api/proxy/[...path]/route.ts
DONE-WHEN: `(cd line-kpi-admin && npx tsc --noEmit && npm run lint)` exit 0, and against a local admin + backend on a local MongoDB: `GET /api/proxy/conversations` and `PATCH /api/proxy/conversations/<id>` with no cookie or a forged/expired cookie return 401 and the backend log shows no request; with a valid cookie they return the same status as before; `POST /api/proxy/auth/login` still works without a cookie.

## Notes
- Found while reviewing PR #11: `line-kpi-admin/src/middleware.ts:25` skips every `/api/` path, and the proxy adds `X-API-Key` for any caller, so anyone who can reach the admin site can read customer conversations and change them.
- Verify with `jose` (`jwtVerify`, same secret as `line-kpi-admin/src/middleware.ts:4`).
- Out of scope: per-permission checks on non-admin backend routes (a logged-in user without a permission can still call them through the proxy).
