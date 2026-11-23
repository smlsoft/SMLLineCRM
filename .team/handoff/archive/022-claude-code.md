## claude-code · task 022 · CLAIMED

- **did:** claimed task 022 - The password reveal accepts only a token whose `sub` is an ObjectId string (otherwise logged `denied` and 403), and the admin dialog ignores a reveal that finishes after it closed or switched employee.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/employees/AssistantLoginDialog.tsx line-kpi-system/src/api/routes/employeeRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/022-reveal-sub-check.md

## claude-code · task 022 · DONE

- **did:** the password reveal uses the token `sub` only when it is an ObjectId string; anything else is treated as no account (logged `denied`, 403) (`line-kpi-system/src/api/routes/employeeRoutes.ts`). The dialog bumps an open counter on every open, close and switch and drops a reveal that resolves under an older counter (`AssistantLoginDialog.tsx`).
- **files touched:** the 2 files in the task's FILES
- **decided:** counter instead of employee id, so close-and-reopen of the same employee also drops the old reply.
- **not checked:** production.
- **next:** none
