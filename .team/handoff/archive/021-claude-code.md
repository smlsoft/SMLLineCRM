## claude-code · task 021 · CLAIMED

- **did:** claimed task 021 - Revealing an employee's assistant password checks the manager's account in the database at that moment (active, superadmin or current `employees` permission), the response is never cached, every attempt (allowed or denied) is logged with the admin id, and the dialog forgets the revealed password when it closes.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-system/src/models/AssistantPasswordView.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/021-password-view-hardening.md

## claude-code · task 021 · DONE

- **did:** `GET /employees/:id/assistant-login/password` re-reads the AdminUser by the token's `sub` and requires `isActive` and superadmin or current effective `employees` permission (`getEffectivePermissions` with its group); sets `Cache-Control: no-store`; 400 for a bad id; logs every attempt in `AssistantPasswordView` with `outcome` (shown, denied, no_key, not_found, no_copy), `adminId`, `viewedBy`, `ip`; logs before the password is sent. The dialog clears password state when it closes.
- **files touched:** the 3 files in the task's FILES
- **decided:** deactivated employees keep their copy; API-key holders can still overwrite a password (user's call).
- **not checked:** production; removing the permission through a PermissionGroup (same code path as additional permissions, which was tested).
- **next:** none
