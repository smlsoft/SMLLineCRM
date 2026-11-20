# Task 003: Triage queue for ambiguous urgent rooms (Layer 2 hand-off)

GOAL: Urgent conversations that the Layer 1 worker cannot decide are queued in MongoDB, an external AI agent can claim them and report a verdict through the agent API, and the monitor page tags each group whose verdict is "needs reply".
MODE: do
FILES: line-kpi-system/src/models/TriageQueueItem.ts line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-system/src/processors/MetricsUpdater.ts line-kpi-system/src/api/routes/monitorRoutes.ts line-kpi-admin/src/types/api.ts line-kpi-admin/src/app/(dashboard)/monitor/page.tsx docs/adr/
DONE-WHEN: (cd line-kpi-system && npx tsc --noEmit) && (cd line-kpi-admin && npx tsc --noEmit && npm run lint) exit 0, and against a LOCAL MongoDB (never the Atlas cluster) the curl sequence enqueue -> claim -> complete(needs_reply) returns 201 -> 200 -> 200, a second claim returns 204, enqueueing the same conversation + lastMessageAtSnapshot again returns 200 with "skipped":"duplicate", and GET /api/v1/monitor shows "triageStatus":"needs_reply" on that group

## Notes
- User decisions for this task: the queue lives in MongoDB (no Redis, so no change to the server's `docker-compose.yml`); Layer 1 and the 30-minute schedule stay in the external `smllinecrm-mcp` worker (`POLL_INTERVAL_SEC=1800`), per `docs/direction.md`; the Layer 2 AI agent runs on another host the user sets up; alerts are monitor-page only for now (LINE push is a later task); `review` / `auto` mode applies to Layer 2 results exactly as to Layer 1. Record the MongoDB-queue choice as an ADR.
- A `resolved` verdict must go through the same checks and `AutoResolveLog` write as `POST /api/v1/auto-resolve/propose` (`line-kpi-system/src/api/routes/autoResolveRoutes.ts:70`) with `layer: "ai"`; extract that logic into a shared function instead of copying it.
- A new customer message must expire open queue items for that conversation, next to the existing `pending_review` expiry in `line-kpi-system/src/processors/MetricsUpdater.ts:62`.
- `claim` must be atomic (`findOneAndUpdate`) with a lease: an item whose lease ran out is claimable again. Count attempts; after 3 failed attempts mark it `failed`.
- Agent endpoints mount under `/api/v1/auto-resolve` (API key only); see the proxy note in `.team/tasks/002-auto-resolve-review-screen.md`.
- Out of scope: changes in `smllinecrm-mcp` and the Layer 2 agent itself (they follow the contract below), the 23:00 `DailyAnalysisJob`, LINE notifications, a queue view on `/auto-resolve`.
- Not touched: `.env`, `.env.local`, `line-kpi-system/dist/`, `line-kpi-admin/.next/`. No permission key changes (no new page).

## Shared contract (Layer 1 worker and Layer 2 agent rely on this)

All under `/api/v1/auto-resolve`, header `X-API-Key`.

- `POST /queue` - Layer 1 worker enqueues a room its rules did not match.
  Body: `{ conversationId, lastMessageAtSnapshot (ISO), reason?, enqueuedBy? }`.
  201 `{ ok: true, item }`; 200 `{ ok: true, skipped: "duplicate" | "employee_already_replied" | "already_resolved" | "stale_snapshot" }`.
- `POST /queue/claim` - agent takes the oldest claimable item.
  Body: `{ agentId, leaseSeconds? (default 300) }`.
  200 `{ item, conversation, messages }` (messages: the same shape the existing `/api/v1/messages` returns, media base64 stripped); 204 when nothing is claimable.
- `POST /queue/:id/complete` - agent reports its verdict while holding the lease.
  Body: `{ agentId, verdict: "resolved" | "needs_reply", reason, confidence? }`.
  `resolved` creates the `AutoResolveLog` (layer `ai`) and returns the same shape as `/propose`; `needs_reply` marks the room. 409 if the lease is lost or the item expired.
- `POST /queue/:id/release` - agent gives the item back after an error.
  Body: `{ agentId, error }`. Increments attempts.
- Queue item status: `pending` | `claimed` | `done` | `failed` | `expired`.
- `GET /api/v1/monitor` adds per group `triageStatus`: `"queued" | "needs_reply" | "resolved_pending_review" | null`.
