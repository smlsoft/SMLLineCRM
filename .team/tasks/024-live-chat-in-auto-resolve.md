# Task 024: Auto-Resolve shows the real conversation, marked where the check happened

GOAL: The history popup on `/auto-resolve` loads the conversation's real messages when opened (like `/monitor`), with a divider at the moment the rule or AI checked it and later messages dimmed; pending-review cards whose saved chat is empty (Layer 2 AI proposals) load the real chat the same way. Nothing new is stored.
MODE: do
FILES: line-kpi-admin/src/app/(dashboard)/auto-resolve/ChatSnapshot.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/LiveChat.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/LogHistoryList.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-admin, and on a local page backed by a LOCAL MongoDB: opening an AI log with an empty saved chat shows the conversation's messages; the divider sits after the last message at or before `lastMessageAtSnapshot`, later messages are dimmed, and the popup opens scrolled to the divider; a rule log shows its live chat the same way; a pending AI card with an empty saved chat shows the live chat; a failed load shows a message instead of an empty box
## Notes
- Agreed with the user: read the messages live instead of storing them; backend unchanged (uses `GET /api/v1/conversations/:id/messages`).
- Saved `snapshotMessages` are kept in the DB; the history popup no longer uses them.
