# Task 005: Count of claimable triage items for the agent wake-up check

GOAL: A Layer 2 agent host can ask how many triage items are claimable right now, without leasing one, so it wakes its agent only when there is work.
MODE: do
FILES: line-kpi-system/src/api/routes/autoResolveRoutes.ts
DONE-WHEN: (cd line-kpi-system && npx tsc --noEmit) exits 0, and against a LOCAL MongoDB (never the Atlas cluster) `GET /api/v1/auto-resolve/queue/count` with `X-API-Key` returns 200 `{"pending":0}` on an empty queue, `{"pending":1}` after one enqueue, `{"pending":0}` while that item is claimed with a live lease, `{"pending":1}` again once its lease has run out, leaves the item's `attempts` unchanged, and returns 401 without the key

## Notes
- Caller: a host crontab on the agent machine polls every 2 minutes in office hours and starts the agent only when `pending > 0`. `POST /queue/claim` cannot serve as the check because it leases an item.
- "Claimable" uses exactly the filter of `POST /queue/claim`: `attempts < TRIAGE_MAX_ATTEMPTS` and (`status: pending`, or `status: claimed` with `leaseUntil` in the past). Read-only: it does not mark exhausted items `failed` or expire stale rooms; claim still does that, so a count can include an item that claim then expires (one empty wake-up, then 0).
- Mount under the existing API-key agent router `/api/v1/auto-resolve`. Name the agent generically: the Layer 2 agent is replaceable.
- Not touched: `.env`, `.env.local`, `line-kpi-system/dist/`, `line-kpi-admin/.next/`. No admin UI, no permission key.

## Shared contract
- `GET /api/v1/auto-resolve/queue/count`, header `X-API-Key` -> 200 `{ "pending": <integer> }`.
