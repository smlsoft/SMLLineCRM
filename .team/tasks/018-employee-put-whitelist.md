# Task 018: Generic employee update accepts only known fields

GOAL: `PUT /api/v1/employees/:id` writes only name, employeeCode, department, assignedGroupIds, isActive and lineUserId, so no body (including `$set` or dotted keys) can set the assistant login fields; the assistant password is capped at 72 bytes.
MODE: do
FILES: line-kpi-system/src/api/routes/employeeRoutes.ts
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-system, and against a LOCAL MongoDB: `PUT /employees/:id` with `{"$set":{...login fields}}`, top-level login fields, or a dotted key leaves the login fields unchanged and does not 500, and `verify` still fails for that employee; a normal edit (name, code, department, isActive) still saves; a password over 72 bytes returns 400; the `/employees` edit form still saves
## Notes
- Review of PR #17 found the blacklist let `$set` through (High). Fix is a whitelist.
