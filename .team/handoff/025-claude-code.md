## claude-code · task 025 · CLAIMED

- **did:** claimed task 025 - Pending-review cards load at most the latest 30 messages without image payloads, and a log whose live conversation is empty (deleted) shows its saved chat with a note.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/auto-resolve/LiveChat.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx line-kpi-admin/src/lib/api.ts line-kpi-system/src/api/routes/messageRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/025-light-live-chat.md

## claude-code · task 025 · DONE

- **did:** `GET /api/v1/conversations/:id/messages` takes optional `limit` (newest N, 1-500, still oldest first; invalid ignored) and `noMedia=1` (media without base64 `data`); no options = unchanged (`line-kpi-system/src/api/routes/messageRoutes.ts`). `messagesApi.list` passes them. `LiveChat` has `light` (30 newest, no media) used by pending cards; it shows the saved chat with a note when the live chat is empty or fails.
- **files touched:** the 4 files in the task's FILES
- **decided:** the history popup still loads the full conversation.
- **not checked:** production.
- **next:** none
