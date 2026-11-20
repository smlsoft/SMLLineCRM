# Direction

Decisions the user has made. Heads follow this; they do not reopen it. Change it only when the user says so.

## Goals
- Track LINE Official Account customer support KPIs in real time and summarize daily conversations with AI.

## Decided
- All browser API requests from `line-kpi-admin` route through `line-kpi-admin/src/app/api/proxy/[...path]/route.ts` to inject `X-API-Key` and JWT.
- AI providers, daily analysis job toggle, and R2/S3 media storage are configured in MongoDB `SystemConfig` (`line-kpi-system/src/models/SystemConfig.ts:101`).
- The Layer 2 auto-resolve AI agent lives outside `SMLLineCRM`, stays swappable, and communicates through REST API/MCP; `SMLLineCRM` hosts the review queue, triage queue, permanent audit log, review/auto mode switch, and the deterministic Layer 1 worker and MCP server (`line-kpi-mcp/`, ADR 0002).

## Forbidden
- Never read, print, or commit secret values from `.env`, `.env.local`, or `.env.production` files.
- Never edit or overwrite `line-kpi-system/dist/` or `line-kpi-admin/.next/` directly (use `npx tsc --noEmit` for type-checking).
- Never add tests or database-dependent jobs to `.github/workflows/deploy.yml` (CI builds and pushes Docker images only).
