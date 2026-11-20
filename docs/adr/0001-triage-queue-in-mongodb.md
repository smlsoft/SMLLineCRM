# ADR 0001: Layer 2 triage queue lives in MongoDB

## Status
Accepted.

## Context
Urgent conversations that Layer 1 rules cannot decide must reach an external AI agent within one 30-minute check cycle, not at the 23:00 daily job. The agent runs on a different host and talks to the backend only over REST. Volume is tens of rooms per cycle.

## Decision
The queue is the `TriageQueueItem` collection (`line-kpi-system/src/models/TriageQueueItem.ts`). The agent claims items with an atomic `findOneAndUpdate` and a lease; one item exists per (conversation, customer-message snapshot).

## Rejected options
- Bull + Redis (as in `dedebireportapi`): adds a service to production and an edit to the server-only `docker-compose.yml` that holds real credentials; the volume does not need it.
- Backend calling the agent directly (push): the agent host would need an inbound endpoint and the backend would own retries.

## Consequences
- No new infrastructure. Throughput is bounded by MongoDB writes, fine at current volume.
- Agents poll `POST /api/v1/auto-resolve/queue/claim`; a crashed agent's item returns after its lease; an item is `failed` after 3 attempts.
- Moving to Redis later needs a new ADR that supersedes this one.
