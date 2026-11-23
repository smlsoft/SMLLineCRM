## claude-code · task 019 · CLAIMED

- **did:** claimed task 019 - On `/employees` a manager can remove an employee's assistant username and password in one step (with a confirm); after that the employee cannot log in and the username is free for someone else.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-admin/src/lib/api.ts line-kpi-system/src/api/routes/employeeRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/019-remove-assistant-login.md

## claude-code · task 019 · DONE

- **did:** `DELETE /api/v1/employees/:id/assistant-login` unsets username, hash and set-time and turns login off (`line-kpi-system/src/api/routes/employeeRoutes.ts`); `employeesApi.removeAssistantLogin`; the `/employees` login dialog shows "ลบชื่อผู้ใช้/รหัสผ่าน" only when a login exists, confirms, then reloads the list.
- **files touched:** the 3 files in the task's FILES
- **decided:** the employee record stays; only the login is removed.
- **not checked:** production; the confirm's Cancel path in a browser (window.confirm was stubbed to OK during the test).
- **next:** none
