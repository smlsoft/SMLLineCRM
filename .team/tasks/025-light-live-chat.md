# Task 025: Light live chat on cards; saved chat when the live one is empty

GOAL: Pending-review cards load at most the latest 30 messages without image payloads, and a log whose live conversation is empty (deleted) shows its saved chat with a note.
MODE: do
FILES: line-kpi-system/src/api/routes/messageRoutes.ts line-kpi-admin/src/lib/api.ts line-kpi-admin/src/app/(dashboard)/auto-resolve/LiveChat.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx
DONE-WHEN: `npx tsc --noEmit` exits 0 in both apps, and against a LOCAL MongoDB: `GET /api/v1/conversations/:id/messages` without options returns the same as before; `?limit=30` returns the newest 30 in time order; `?noMedia=1` returns no `mediaId.data`; a bad limit is clamped; cards request `limit=30&noMedia=1`; the history popup still loads the full chat; an empty live chat with a saved chat shows the saved chat and a note
## Notes
- From the review of PR #24 (two Medium findings).
