## claude-code · task 018 · CLAIMED

- **did:** claimed task 018 - `PUT /api/v1/employees/:id` writes only name, employeeCode, department, assignedGroupIds, isActive and lineUserId, so no body (including `$set` or dotted keys) can set the assistant login fields; the assistant password is capped at 72 bytes.
- **files touched:** none yet (claimed: line-kpi-system/src/api/routes/employeeRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/018-employee-put-whitelist.md

## claude-code · task 018 · DONE

- **did:** `PUT /api/v1/employees/:id` copies only `EDITABLE_FIELDS` (lineUserId, name, employeeCode, department, assignedGroupIds, isActive) from the body (`line-kpi-system/src/api/routes/employeeRoutes.ts`); the assistant password is refused above 72 UTF-8 bytes.
- **files touched:** line-kpi-system/src/api/routes/employeeRoutes.ts
- **decided:** whitelist instead of blacklist. `ASSISTANT_LOGIN_FIELDS` in `line-kpi-system/src/models/Employee.ts` is now unused (file outside this task; left as is).
- **not checked:** the `/employees` edit form in a browser (the API call it sends was exercised); production.
- **next:** none
