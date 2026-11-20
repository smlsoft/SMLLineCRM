# Task 010: Monitor and Auto-Resolve stay in sync

GOAL: A room's auto-resolve proposal follows what happens to the room elsewhere: pressing Resolved on `/monitor` approves its pending proposal (recording who and that it came from Monitor), undoing it reverts that proposal, a staff reply expires a pending proposal, and `/auto-resolve` reloads itself every 30 s like `/monitor`.
MODE: do
FILES: line-kpi-system/src/api/routes/conversationRoutes.ts line-kpi-system/src/processors/MetricsUpdater.ts line-kpi-system/src/api/middleware/jwtAuth.ts line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-admin/src/app/(dashboard)/auto-resolve/
DONE-WHEN: (cd line-kpi-system && npx tsc --noEmit) && (cd line-kpi-admin && npx tsc --noEmit && npm run lint) exit 0 with no new warnings, and against a LOCAL MongoDB: PATCH a conversation with `responseStatusOverride: "normal"` through the admin proxy turns its `pending_review` log into `approved` with `reviewedBy` = the logged-in username and a Monitor note; PATCH `null` turns that log into `reverted`; a staff message processed by MetricsUpdater after the snapshot turns a `pending_review` log into `expired` with reason "พนักงานตอบแล้ว"; and `/auto-resolve` open in a browser shows such a change within 30 s without a manual refresh or a loading flash
## Notes
- User decisions: sync both ways; "real time" = both pages refresh every 30 s (no push channel).
- Only logs about the current customer message are touched: `lastMessageAtSnapshot >= conversation.lastCustomerMessageAt` (same rule the approve route uses, `line-kpi-system/src/api/routes/autoResolveRoutes.ts:705`).
- The proxy forwards the JWT only for `admin/*` today; forward it for every non-auth path so `PATCH /conversations/:id` can record the user. Backend reads it optionally; API key stays the gate. No permission key change.
- Not touched: `.env`, `.env.local`, `dist/`, `.next/`.
