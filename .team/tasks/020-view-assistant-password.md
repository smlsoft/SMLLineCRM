# Task 020: Managers can see an employee's saved assistant password

GOAL: On `/employees` the assistant-login dialog has an eye button; it shows the password being typed, and for a saved password it fetches and shows the stored one. Every reveal is logged (who, whose, when).
MODE: do
FILES: line-kpi-system/src/config/index.ts line-kpi-system/src/models/Employee.ts line-kpi-system/src/models/AssistantPasswordView.ts line-kpi-system/src/services/assistantPasswordCrypto.ts line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-admin/src/lib/api.ts line-kpi-admin/src/types/api.ts
DONE-WHEN: `npx tsc --noEmit` exits 0 in both apps, and against a LOCAL MongoDB with `ASSISTANT_PASSWORD_KEY` set: setting a password stores the bcrypt hash plus an AES-256-GCM copy (no plain text in the DB); `GET /employees/:id/assistant-login/password` returns it only with an admin JWT that is superadmin or has the `employees` permission (API key alone → 403) and writes one view-log row; a password set before the key existed returns 404 with a Thai message; without the key the GET returns 503 and setting a password still works; removing the login clears the copy; no employee response contains the copy; the dialog's eye button reveals typed and saved passwords
## Notes
- Agreed with the user (option ข.): reversible copy for viewing; risk accepted that anyone with `/employees` access can read staff passwords; view log required.
- Server needs a new backend env `ASSISTANT_PASSWORD_KEY` (any long random string; hashed to a 256-bit key).
- Login check (`/assistant/auth/verify`) keeps using only the bcrypt hash.
