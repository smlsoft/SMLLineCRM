## claude-code · task 005 · CLAIMED

- **did:** claimed task 005 - A Layer 2 agent host can ask how many triage items are claimable right now, without leasing one, so it wakes its agent only when there is work.
- **files touched:** none yet (claimed: line-kpi-system/src/api/routes/autoResolveRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/005-triage-queue-count.md

## claude-code · task 005 · DONE

- **did:** added `GET /api/v1/auto-resolve/queue/count` (API key) returning `{ pending }` with the same filter as `POST /queue/claim`, read-only (`line-kpi-system/src/api/routes/autoResolveRoutes.ts:320`).
- **files touched:** line-kpi-system/src/api/routes/autoResolveRoutes.ts
- **decided:** the count does not expire stale rooms or fail exhausted items; claim still does, so a count can include one item that claim then drops.
- **not checked:** production; the agent host's crontab; reachability of port 3102 from the agent host. Verified only against a scratch local MongoDB (`line_kpi_t005`, dropped).
- **next:** the agent host polls this endpoint and wakes the Layer 2 agent when `pending > 0`.
