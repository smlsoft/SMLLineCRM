## claude-code · task 015 · CLAIMED

- **did:** claimed task 015 - The "ประวัติ Log ทั้งหมด" tab on `/auto-resolve` shows one compact row per log with everything except the chat (status, layer, rule code or AI confidence, group, time, proposer, reason, and the outcome: who approved/rejected/reverted and when, review note, or why it expired); clicking a row opens a popup with the same details, the chat snapshot and the row's actions.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/auto-resolve/ChatSnapshot.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/LogHistoryList.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/logParts.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/015-history-list-with-chat-popup.md

## claude-code · task 015 · DONE

- **did:** the "ประวัติ Log ทั้งหมด" tab renders `LogHistoryList.tsx`: one row per log with group, status, layer (rule code or AI %), reason, outcome (who/when/note or expiry reason), time, proposer and message count; a click opens a popup with the chat snapshot and the log's actions. Badges, status config and outcome text moved to `logParts.tsx` and are shared with the pending-review cards; the card footer became `renderActions` in `page.tsx`. `ChatSnapshot` takes an optional `className` for its height.
- **files touched:** line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx ChatSnapshot.tsx logParts.tsx LogHistoryList.tsx
- **decided:** the pending-review tab keeps its cards with the chat shown; an action in the popup reloads the list and closes the popup.
- **not checked:** production data; the reject flow inside the popup (revert was exercised).
- **next:** none
