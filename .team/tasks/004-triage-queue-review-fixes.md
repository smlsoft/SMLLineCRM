# Task 004: Fix PR #4 review findings in the triage queue

GOAL: `/propose` and `/queue` accept a numeric epoch `lastMessageAtSnapshot` again, the monitor stops showing "queued" for an item whose last allowed attempt's lease ran out, and a `resolved` verdict that `submitProposal` rejects with 4xx no longer leaves the queue item stuck in `claimed`.
MODE: do
FILES: line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-system/src/api/routes/monitorRoutes.ts
DONE-WHEN: (cd line-kpi-system && npx tsc --noEmit) exits 0, and against a LOCAL MongoDB (never the Atlas cluster): `/propose` with a numeric `lastMessageAtSnapshot` returns the same 200/201 as with the ISO string; an item `claimed` with `attempts: 3` and `leaseUntil` in the past gives `triageStatus: null` on `GET /api/v1/monitor`; completing `resolved` for an item whose conversation was deleted returns 404 and leaves the item `expired` with an `expiredReason`

## Notes
- Findings come from the review of https://github.com/smlsoft/SMLLineCRM/pull/4 (items 1, anomalies 2 and 3).
- A 4xx from `submitProposal` other than 404 means the agent sent a bad request: give the item back (`pending`, or `failed` at `TRIAGE_MAX_ATTEMPTS`) with `lastError`, same as `/release`.
- Out of scope: a confidence threshold for auto mode (a policy decision the user has not made).
