## claude-code · task 020 · CLAIMED

- **did:** claimed task 020 - On `/employees` the assistant-login dialog has an eye button; it shows the password being typed, and for a saved password it fetches and shows the stored one. Every reveal is logged (who, whose, when).
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-admin/src/lib/api.ts line-kpi-admin/src/types/api.ts line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-system/src/config/index.ts line-kpi-system/src/models/AssistantPasswordView.ts line-kpi-system/src/models/Employee.ts line-kpi-system/src/services/assistantPasswordCrypto.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/020-view-assistant-password.md

## claude-code · task 020 · DONE

- **did:** Setting an assistant password also stores an AES-256-GCM copy (`assistantPasswordEnc`, `select: false`) when `ASSISTANT_PASSWORD_KEY` is set (`line-kpi-system/src/services/assistantPasswordCrypto.ts`). `GET /api/v1/employees/:id/assistant-login/password` returns it only to an admin JWT that is superadmin or has `employees`, and logs each reveal in `AssistantPasswordView` (`line-kpi-system/src/models/AssistantPasswordView.ts`). DELETE login clears the copy. The `/employees` dialog has an eye button that shows typed text or fetches the saved password; saving the revealed value unchanged does not reset it.
- **files touched:** the task's FILES except `line-kpi-admin/src/types/api.ts` (not needed)
- **decided:** API key alone cannot read passwords (403), so the assistant app cannot. Without the key: 503 on view, setting still works and drops any old copy. Login verify still uses only bcrypt.
- **not checked:** production; the dialog's error note in a browser (the 404/503 texts were checked through the API); view log has no screen (read it in MongoDB, collection `assistantpasswordviews`).
- **next:** user adds `ASSISTANT_PASSWORD_KEY` to the backend and re-sets passwords set before this change.
