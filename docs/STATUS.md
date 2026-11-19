# STATUS

- **now:** Backend (`line-kpi-system/`) and Admin Dashboard (`line-kpi-admin/`) compile cleanly; incoming customer messages clear `responseStatusOverride` (`line-kpi-system/src/processors/MetricsUpdater.ts:42`) so Monitor reopens waiting/slow status on follow-up questions.
- **open:** Task 001 PR awaiting review (`needs-review`).
- **next:** Design and build the `AutoResolveLog` review queue/log screen and API in `SMLLineCRM` plus the external `smllinecrm-mcp` server.
- **watch out:** `docker-compose.yml:14-15` still lists legacy cron env names (`CRON_CLOSE_CONVERSATIONS`, `CRON_DAILY_EVALUATION`) while code reads `CRON_DAILY_ANALYSIS` (`line-kpi-system/src/config/index.ts:42`); no automated test suite exists.
