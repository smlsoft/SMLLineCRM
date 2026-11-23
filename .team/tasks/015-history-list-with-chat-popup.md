# Task 015: Auto-Resolve history tab is a list; the chat opens in a popup

GOAL: The "ประวัติ Log ทั้งหมด" tab on `/auto-resolve` shows one compact row per log with everything except the chat (status, layer, rule code or AI confidence, group, time, proposer, reason, and the outcome: who approved/rejected/reverted and when, review note, or why it expired); clicking a row opens a popup with the same details, the chat snapshot and the row's actions.
MODE: do
FILES: line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/ChatSnapshot.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/logParts.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/LogHistoryList.tsx
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-admin, and on a local page backed by a LOCAL MongoDB: the history tab shows rows with no chat, each status's outcome text is visible on its row, clicking a row opens the popup with the chat scrolled to the newest message, an action in the popup (approve or revert) updates the row, the popup closes with X, backdrop and Escape, and the layout holds at phone width and in dark mode; the "รอตรวจ" tab is unchanged
## Notes
- Requested by the user: list first, chat only when they want to read it.
- The pending-review tab keeps its cards with the chat shown.
