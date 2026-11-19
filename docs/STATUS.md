# STATUS

- **now:** Backend (`line-kpi-system/`) and Admin Dashboard (`line-kpi-admin/`) compile cleanly; Task 002 adds `AutoResolveLog`, customer-message pending-review expiration (`line-kpi-system/src/processors/MetricsUpdater.ts:62`), `/api/v1/auto-resolve` + `/api/v1/admin/auto-resolve` APIs, `auto-resolve` RBAC permission, and `/auto-resolve` review/audit dashboard.
- **open:** Task 001 and Task 002 PRs awaiting review (`needs-review`); `/auto-resolve` and external `smllinecrm-mcp` not yet exercised against a live MongoDB instance.
- **next:** Run `smllinecrm-mcp` Layer 1 check against a running backend in `review` mode, verify suggestions on `/auto-resolve`, then add Layer 2 AI escalation once Layer 1 accuracy is confirmed.
- **watch out:** `docker-compose.yml:14-15` still lists legacy cron env names (`CRON_CLOSE_CONVERSATIONS`, `CRON_DAILY_EVALUATION`) while code reads `CRON_DAILY_ANALYSIS` (`line-kpi-system/src/config/index.ts:42`); no automated test suite exists in `SMLLineCRM`.
