## claude-code · task 004 · CLAIMED

- **did:** claimed task 004 - `/propose` and `/queue` accept a numeric epoch `lastMessageAtSnapshot` again, the monitor stops showing "queued" for an item whose last allowed attempt's lease ran out, and a `resolved` verdict that `submitProposal` rejects with 4xx no longer leaves the queue item stuck in `claimed`.
- **files touched:** none yet (claimed: line-kpi-system/src/api/routes/autoResolveRoutes.ts line-kpi-system/src/api/routes/monitorRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/004-triage-queue-review-fixes.md

## claude-code · task 004 · DONE

- **did:** `parseIsoDate` accepts epoch milliseconds again (`line-kpi-system/src/api/routes/autoResolveRoutes.ts:89`); a `resolved` verdict that `submitProposal` rejects with 404 expires the item, any other 4xx returns it to `pending`/`failed` with `lastError` (`autoResolveRoutes.ts` `/queue/:id/complete`); the monitor ignores `claimed` items whose lease ran out on the last attempt (`line-kpi-system/src/api/routes/monitorRoutes.ts` `attachTriageStatus`). Verified on a scratch local MongoDB: tsc exit 0; `/propose` with numeric epoch 201, same snapshot as ISO 200 `duplicate`; `/queue` with numeric epoch 201; snapshot `0` and `"abc"` 400; claimed item attempts 3 + past lease -> `triageStatus` null, attempts 2 + past lease -> `queued`; resolved on deleted conversation -> 404 and item `expired` "proposal rejected: Conversation not found"; enqueue/claim/complete(needs_reply)/claim 201/200/200/204 and monitor `needs_reply`.
- **files touched:** `line-kpi-system/src/api/routes/autoResolveRoutes.ts`, `line-kpi-system/src/api/routes/monitorRoutes.ts`, `docs/STATUS.md`
- **decided:** none
- **not checked:** the non-404 4xx branch of `/complete` (no request reaches it: the server builds that proposal itself); auto mode; LINE webhook path; production data.
- **next:** start at `line-kpi-system/src/api/routes/autoResolveRoutes.ts:1` - decide whether auto mode needs a minimum `confidence` before applying AI `resolved` verdicts.
