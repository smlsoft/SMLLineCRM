## claude-code · task 029 · CLAIMED

- **did:** claimed task 029 - `POST /api/v1/auto-resolve/queue/claim` returns `conversation.minutesSinceLastCustomerMessage` computed by code, and `POST /queue/:id/complete` with verdict `resolved` stores `needs_reply` (reason prefixed with the system override text) when the latest customer message is an image, file, video, audio or location.
- **files touched:** none yet (claimed: line-kpi-mcp/src/client.ts line-kpi-mcp/src/server.ts line-kpi-system/src/api/routes/autoResolveRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/029-triage-code-guards.md

## claude-code · task 029 · DONE

- **did:** claim response carries `conversation.minutesSinceLastCustomerMessage`; complete with `resolved` is stored as `needs_reply` with the override prefix when the customer's latest message is image/file/video/audio/location; MCP client type and tool descriptions name both. ADR 0003.
- **files touched:** line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-mcp/src/client.ts line-kpi-mcp/src/server.ts docs/adr/0003-triage-verdict-code-guards.md docs/STATUS.md
- **decided:** guards only turn resolved into needs_reply (ADR 0003); `audio` counts as media, `sticker` and `other` do not.
- **not checked:** a `needs_reply` verdict on a text room after the refactor (code path unchanged apart from variable names); the real agent on 192.168.2.203 reading the new field; auto mode (local runs used the default review mode); production data; deploy.
- **next:** update the instruction in `smllinecrm-agent` `office/mcp/triage-instruction.md` to read `conversation.minutesSinceLastCustomerMessage` and treat `overridden: true` as success; then deploy backend.
