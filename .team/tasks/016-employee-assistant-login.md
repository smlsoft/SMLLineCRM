# Task 016: Employees get a username and password for the AI assistant app

GOAL: A manager sets or resets each employee's assistant username and password and turns assistant login on or off on `/employees`; the assistant app checks a username and password over HTTP Basic auth and gets the employee back.
MODE: do
FILES: line-kpi-system/src/models/Employee.ts line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-system/src/api/routes/assistantAuthRoutes.ts line-kpi-system/src/api/router.ts line-kpi-admin/src/app/(dashboard)/employees/page.tsx line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-admin/src/lib/api.ts line-kpi-admin/src/types/api.ts
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-system and line-kpi-admin, and against a LOCAL MongoDB: a manager sets username and password on `/employees`; `POST /api/v1/assistant/auth/verify` with `X-API-Key` and `Authorization: Basic` returns 200 `{_id,name,employeeCode}` for the right password, 401 for a wrong password, unknown user, login turned off, or inactive employee, and 401 without the API key; no employee response (list, get, create, update) contains the password hash; `PUT /employees/:id` cannot set username, hash or the login switch; a duplicate username is refused; a password under 8 characters is refused
## Notes
- Agreed with the user: Basic auth, the existing `X-API-Key`, bcrypt hash (same as admin users), minimum 8 characters, no lockout, no separate key, staff cannot change their own password yet.
- Requested through the Layer 2 agent session for the new staff-facing assistant app (office host, behind Caddy, reachable from the internet).
- Not in scope: live message stream, assistant group list.
