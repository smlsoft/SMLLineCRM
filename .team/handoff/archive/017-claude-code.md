## claude-code · task 017 · CLAIMED

- **did:** claimed task 017 - `GET /api/v1/assistant/groups/:groupId/stream` (Server-Sent Events, `X-API-Key`) pushes every new message of that CustomerGroup, customer and staff, as soon as the webhook saves it, in the same JSON shape as one item of `GET /api/v1/messages`.
- **files touched:** none yet (claimed: line-kpi-system/src/api/router.ts line-kpi-system/src/api/routes/assistantStreamRoutes.ts line-kpi-system/src/api/routes/groupMessageRoutes.ts line-kpi-system/src/processors/MessageProcessor.ts line-kpi-system/src/services/ImageFetchService.ts line-kpi-system/src/services/MessageStream.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/017-assistant-group-stream.md

## claude-code · task 017 · DONE

- **did:** `GET /api/v1/assistant/groups/:groupId/stream` (`line-kpi-system/src/api/routes/assistantStreamRoutes.ts`) streams SSE: `event: message` / `event: message_update` with `id: <message _id>` and the `GET /api/v1/messages` item as data, `retry: 5000`, `: ping` every 25 s. `MessageStream.ts` holds in-process subscribers per group and loads a message once per publish, only when the group has subscribers. `MessageProcessor` publishes right after `Message.create`; image messages publish `message_update` once `fetchAndStoreImage` (now returns boolean) stored the media. `/messages` uses the same `loadMessageItems` query.
- **files touched:** the 6 files in the task's FILES
- **decided:** no history replay on connect; 404 for an unknown group; in-process bus (one backend container).
- **not checked:** `message_update` for images (local LINE token is fake, media fetch fails); production Traefik buffering; many concurrent streams.
- **next:** send the event format to the Layer 2 agent session after deploy.
