# Task 019: Remove an employee's AI assistant login

GOAL: On `/employees` a manager can remove an employee's assistant username and password in one step (with a confirm); after that the employee cannot log in and the username is free for someone else.
MODE: do
FILES: line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-admin/src/lib/api.ts
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-system and line-kpi-admin, and against a LOCAL MongoDB: `DELETE /api/v1/employees/:id/assistant-login` clears username, hash, set-time and turns login off; `verify` with the old credentials returns 401; the freed username can be given to another employee; the `/employees` dialog has a remove button only when a login exists, asks to confirm, and the row then shows "-"
## Notes
- Requested by the user after task 016.
- The employee record itself stays; only the login is removed.
