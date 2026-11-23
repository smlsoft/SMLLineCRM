# Task 021: Password reveal re-checks the manager and logs every attempt

GOAL: Revealing an employee's assistant password checks the manager's account in the database at that moment (active, superadmin or current `employees` permission), the response is never cached, every attempt (allowed or denied) is logged with the admin id, and the dialog forgets the revealed password when it closes.
MODE: do
FILES: line-kpi-system/src/api/routes/employeeRoutes.ts line-kpi-system/src/models/AssistantPasswordView.ts line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx
DONE-WHEN: `npx tsc --noEmit` exits 0 in both apps, and against a LOCAL MongoDB: an old token of a manager who was deactivated, or whose `employees` permission was removed (group or additional), gets 403; an active manager with the permission and superadmin get 200; the response has `Cache-Control: no-store`; each attempt writes one log row with outcome, admin id and username (no JWT → outcome logged without an admin); closing the dialog clears the password from the form state
## Notes
- From the review of PR #21 (Medium: JWT permission snapshot valid up to 7 days; Low: cache, log gaps, state after close).
- Not changed (user's call): deactivated employees keep their copy; API-key holders can still overwrite a password.
