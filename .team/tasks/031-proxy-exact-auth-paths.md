# Task 031: Admin proxy opens only the exact auth paths without login

GOAL: The login exemption in the admin proxy matches only the exact paths `auth/login`, `auth/logout` and `auth/me`, so a path such as `auth/..%2fconversations` needs a valid login like every other path.
MODE: do
FILES: line-kpi-admin/src/app/api/proxy/[...path]/route.ts
DONE-WHEN: `(cd line-kpi-admin && npx tsc --noEmit && npm run lint)` exit 0, and against a local admin + backend on a local MongoDB: `GET /api/proxy/auth/..%2fconversations` without a cookie returns the proxy's 401 `Unauthorized: login required`; `POST /api/proxy/auth/login` and `POST /api/proxy/auth/logout` without a cookie still return 200.

## Notes
- Found by the review of https://github.com/smlsoft/SMLLineCRM/pull/30: `path.startsWith('auth/')` let `auth/..%2fconversations` past the gate; the proxy then requested `/api/v1/conversations` without the API key, so the backend answered 401 (no data leaked).
