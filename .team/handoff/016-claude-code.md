## claude-code · task 016 · CLAIMED

- **did:** claimed task 016 - A manager sets or resets each employee's assistant username and password and turns assistant login on or off on `/employees`; the assistant app checks a username and password over HTTP Basic auth and gets the employee back.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-admin/src/app/(dashboard)/employees/page.tsx line-kpi-admin/src/lib/api.ts line-kpi-admin/src/types/api.ts line-kpi-system/src/api/router.ts line-kpi-system/src/api/routes/assistantAuthRoutes.ts line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-system/src/models/Employee.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/016-employee-assistant-login.md

## claude-code · task 016 · DONE

- **did:** Employee has `assistantUsername` (unique when set, lowercase), `assistantPasswordHash` (bcrypt, `select: false`), `assistantPasswordSetAt`, `assistantLoginEnabled` (`line-kpi-system/src/models/Employee.ts`). `PUT /api/v1/employees/:id/assistant-login` sets username, password (min 8) and the switch; the generic `PUT /employees/:id` strips those fields. `POST /api/v1/assistant/auth/verify` (`assistantAuthRoutes.ts`) checks `Authorization: Basic` behind `X-API-Key` and returns `{_id,name,employeeCode}` or 401. `/employees` has an "แอปผู้ช่วย AI" column and a key button opening `AssistantLoginDialog.tsx`.
- **files touched:** the 8 files in the task's FILES
- **decided:** one generic 401 message for every failure; unknown usernames still run a bcrypt compare; no lockout (agreed with the user).
- **not checked:** production; dark mode and phone width of the new dialog; the assistant app itself (not built yet).
- **next:** the Layer 2 agent session needs the endpoint contract.
