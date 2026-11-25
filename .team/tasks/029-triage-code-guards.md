# Task 029: Deterministic guards for Layer 2 triage

GOAL: `POST /api/v1/auto-resolve/queue/claim` returns `conversation.minutesSinceLastCustomerMessage` computed by code, and `POST /queue/:id/complete` with verdict `resolved` stores `needs_reply` (reason prefixed with the system override text) when the latest customer message is an image, file, video, audio or location.
MODE: do
FILES: line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-mcp/src/client.ts line-kpi-mcp/src/server.ts
DONE-WHEN: `(cd line-kpi-system && npx tsc --noEmit) && (cd line-kpi-mcp && npx tsc --noEmit && npm test)` exit 0, and against a local backend with a local MongoDB: claim returns the minutes field with the correct value; completing `resolved` on a room whose last customer message is an image stores `needs_reply` with the override prefix and returns 200; a room whose last customer message is text still goes through the `resolved` proposal path.

## Notes
- Guards may only turn `resolved` into `needs_reply`, never the reverse (a missed reply costs more than an extra alert).
- Stickers are not media for this rule. `other` is not treated as media.
- The agent instruction in the separate `smllinecrm-agent` repo will be updated afterwards to read the minutes field; not part of this task.
