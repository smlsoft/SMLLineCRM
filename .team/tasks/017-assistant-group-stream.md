# Task 017: Live message stream per group for the AI assistant app

GOAL: `GET /api/v1/assistant/groups/:groupId/stream` (Server-Sent Events, `X-API-Key`) pushes every new message of that CustomerGroup, customer and staff, as soon as the webhook saves it, in the same JSON shape as one item of `GET /api/v1/messages`.
MODE: do
FILES: line-kpi-system/src/services/MessageStream.ts line-kpi-system/src/processors/MessageProcessor.ts line-kpi-system/src/services/ImageFetchService.ts line-kpi-system/src/api/routes/assistantStreamRoutes.ts line-kpi-system/src/api/routes/groupMessageRoutes.ts line-kpi-system/src/api/router.ts
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-system, and against a LOCAL MongoDB with a signed local webhook call: a connected stream receives `event: message` for a new customer message and a new staff message in its group, not for another group's message; the data equals the matching item of `GET /api/v1/messages?groupId=`; a `: ping` comment arrives on the interval; a bad id returns 400, an unknown group 404, no API key 401; a closed client is unsubscribed; with no subscriber a new message triggers no extra DB read
## Notes
- Agreed with the user: existing `X-API-Key`; no separate key; no rate limit; login stays the Basic-auth verify from task 016.
- In-process events: correct while production runs one backend container. More than one needs a shared bus.
- Image messages: `event: message` first (no media yet), then `event: message_update` with the media once it is stored.
- Requested by the Layer 2 agent session for the staff AI assistant app.
