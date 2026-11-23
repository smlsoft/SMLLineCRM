# Task 022: Password reveal rejects malformed token ids and drops late results

GOAL: The password reveal accepts only a token whose `sub` is an ObjectId string (otherwise logged `denied` and 403), and the admin dialog ignores a reveal that finishes after it closed or switched employee.
MODE: do
FILES: line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx
DONE-WHEN: `npx tsc --noEmit` exits 0 in both apps, and against a LOCAL backend started with a local JWT_SECRET: tokens signed with `sub` as `{"$ne":null}`, a non-ObjectId string, or missing return 403 and each writes one `denied` row; a valid manager token still returns 200; in the dialog a reveal that resolves after close leaves the form empty
## Notes
- From the re-review of PR #22 (two Low findings, both need the JWT secret).
