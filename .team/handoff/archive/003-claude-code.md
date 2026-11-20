## claude-code · task 003 · CLAIMED

- **did:** claimed task 003 - Urgent conversations that the Layer 1 worker cannot decide are queued in MongoDB, an external AI agent can claim them and report a verdict through the agent API, and the monitor page tags each group whose verdict is "needs reply".
- **files touched:** none yet (claimed: docs/adr/ line-kpi-admin/src/app/(dashboard)/monitor/page.tsx line-kpi-admin/src/types/api.ts line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-system/src/api/routes/monitorRoutes.ts line-kpi-system/src/models/TriageQueueItem.ts line-kpi-system/src/processors/MetricsUpdater.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/003-triage-queue.md

## claude-code · task 003 · DONE

- **did:** Added `TriageQueueItem` model; agent endpoints `POST /api/v1/auto-resolve/queue`, `/queue/claim`, `/queue/:id/complete`, `/queue/:id/release` (`line-kpi-system/src/api/routes/autoResolveRoutes.ts`), with `/propose` logic extracted into `submitProposal` and reused for `resolved` verdicts (layer `ai`); open queue items expire on any new message (`line-kpi-system/src/processors/MetricsUpdater.ts`); `GET /api/v1/monitor` adds `triageStatus` per conversation and group (`line-kpi-system/src/api/routes/monitorRoutes.ts`); monitor page shows a triage badge (`line-kpi-admin/src/app/(dashboard)/monitor/page.tsx`). Verified on local MongoDB: tsc both packages and admin lint exit 0; enqueue 201, re-enqueue 200 `skipped:"duplicate"`, claim 200 with messages, complete(needs_reply) 200, second claim 204, monitor `triageStatus:"needs_reply"`; wrong agent complete 409; resolved verdict in review mode creates `pending_review` log (layer `ai`) and monitor shows `resolved_pending_review`; 3 releases -> `failed`, then claim 204; new customer message expires the item; expired 30 s lease is re-claimed by another agent; monitor badges render in the browser (DOM read, pane hidden so no screenshot).
- **files touched:** `line-kpi-system/src/models/TriageQueueItem.ts`, `line-kpi-system/src/api/routes/autoResolveRoutes.ts`, `line-kpi-system/src/processors/MetricsUpdater.ts`, `line-kpi-system/src/api/routes/monitorRoutes.ts`, `line-kpi-admin/src/types/api.ts`, `line-kpi-admin/src/app/(dashboard)/monitor/page.tsx`, `docs/adr/0001-triage-queue-in-mongodb.md`, `docs/STATUS.md`
- **decided:** queue in MongoDB (ADR 0001).
- **not checked:** `auto` mode with a `resolved` verdict (same code path as `/propose`, not run); real LINE webhook path (expiry tested by calling `MetricsUpdater.update` directly); production data; visual screenshot of the badge; `smllinecrm-mcp` worker calling `/queue`.
- **next:** start at `../smllinecrm-mcp/src/worker/run-layer1.ts` - enqueue rooms no Layer 1 rule matched via `POST /api/v1/auto-resolve/queue`.
