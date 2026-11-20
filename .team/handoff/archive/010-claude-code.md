## claude-code · task 010 · CLAIMED

- **did:** claimed task 010 - A room's auto-resolve proposal follows what happens to the room elsewhere: pressing Resolved on `/monitor` approves its pending proposal (recording who and that it came from Monitor), undoing it reverts that proposal, a staff reply expires a pending proposal, and `/auto-resolve` reloads itself every 30 s like `/monitor`.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/auto-resolve/ line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-system/src/api/middleware/jwtAuth.ts line-kpi-system/src/api/routes/conversationRoutes.ts line-kpi-system/src/processors/MetricsUpdater.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/010-monitor-auto-resolve-sync.md

## claude-code · task 010 · DONE

- **did:** `PATCH /conversations/:id` with `normal` approves the room's current `pending_review` proposal (`reviewedBy` = logged-in user, note "ยืนยันจากหน้า Monitor") and expires its open queue items; with `null` it reverts the current approved/auto-resolved proposal (`line-kpi-system/src/api/routes/conversationRoutes.ts`). A staff message now expires pending proposals with "พนักงานตอบแล้ว" (`line-kpi-system/src/processors/MetricsUpdater.ts`). `readOptionalAdmin` added (`line-kpi-system/src/api/middleware/jwtAuth.ts`); the proxy forwards the JWT on every non-auth path. `/auto-resolve` refreshes silently every 30 s with a Monitor-style countdown on the refresh button and a last-updated line, and shows the review note on approved entries.
- **files touched:** line-kpi-system/src/api/routes/conversationRoutes.ts line-kpi-system/src/processors/MetricsUpdater.ts line-kpi-system/src/api/middleware/jwtAuth.ts line-kpi-admin/src/app/api/proxy/[...path]/route.ts line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx
- **decided:** both pages read the same per-room status from the backend; "real time" = refresh (manual any time, auto every 30 s), no push channel.
- **not checked:** production; the Monitor page's own Resolved button click (exercised the same PATCH through the proxy instead). Verified on local MongoDB `line_kpi_local` (test rows deleted): Monitor Resolved → approved by `superadmin` with the note, card left `/auto-resolve` after 23 s with no skeleton; undo → reverted; staff reply via MetricsUpdater → expired "พนักงานตอบแล้ว"; approve on Auto-Resolve → Monitor room `slow` → `normal`, badge gone.
- **next:** none
