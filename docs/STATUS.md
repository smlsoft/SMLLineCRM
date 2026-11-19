# STATUS

- **now:** Backend (`line-kpi-system/`) and Admin Dashboard (`line-kpi-admin/`) compile cleanly; real-time LINE webhook monitor, RBAC, AI provider failover, daily analysis job, and R2/S3 media storage are active.
- **open:** `line-kpi-system/src/processors/MetricsUpdater.ts:38` does not clear `responseStatusOverride` when a customer sends a new message in an open conversation.
- **next:** Task 001 to reset `responseStatusOverride` on incoming customer messages, followed by the auto-resolve review queue/log API and external MCP server.
- **watch out:** `docker-compose.yml:14-15` still lists legacy cron env names (`CRON_CLOSE_CONVERSATIONS`, `CRON_DAILY_EVALUATION`) while code reads `CRON_DAILY_ANALYSIS` (`line-kpi-system/src/config/index.ts:42`); no automated test suite exists.
