## claude-code · task 024 · CLAIMED

- **did:** claimed task 024 - The history popup on `/auto-resolve` loads the conversation's real messages when opened (like `/monitor`), with a divider at the moment the rule or AI checked it and later messages dimmed; pending-review cards whose saved chat is empty (Layer 2 AI proposals) load the real chat the same way. Nothing new is stored.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/auto-resolve/ChatSnapshot.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/LiveChat.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/LogHistoryList.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/024-live-chat-in-auto-resolve.md

## claude-code · task 024 · DONE

- **did:** `LiveChat.tsx` reads `GET /conversations/:id/messages` when shown and renders `ChatSnapshot` with `markerAt = lastMessageAtSnapshot`; `ChatSnapshot` draws a divider after the last message at or before that time, dims later messages and opens scrolled to the divider. The history popup always uses the live chat (saved chat only as a fallback when loading fails); pending-review cards use the live chat when no chat was saved (Layer 2 AI).
- **files touched:** the 4 files in the task's FILES
- **decided:** nothing new stored; old task 023 (store 10 messages in the backend) was cancelled by the user and its claim removed.
- **not checked:** production; dark mode and phone width of the divider.
- **next:** none
