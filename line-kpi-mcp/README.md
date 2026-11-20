# line-kpi-mcp

MCP server and deterministic Layer-1 worker for `SMLLineCRM` (no AI here). The Layer 2 AI agent stays outside this repo.

## Features
- **MCP Server (`stdio`)** over the `SMLLineCRM` REST API (`X-API-Key` auth):
  - Read: `list_pending_groups`, `get_group_messages` (base64 stripped), `evaluate_layer1_rule`,
    `get_employee_activity_today`, `list_employees`, `list_daily_jobs` (categorized after the 23:00 job),
    `list_conversations` (transcripts stripped)
  - Write (hidden when `MCP_READ_ONLY=true`): `propose_auto_resolve`, and the Layer 2 queue tools
    `claim_triage_item`, `complete_triage_item`, `release_triage_item`
- **Layer-1 Worker (`src/worker/run-layer1.ts`)**: zero-token rule checker (`--dry-run` or `--loop`).
  By default checks only urgent (`slow`, customer waiting > 15 min) rooms every `POLL_INTERVAL_SEC`
  (1800) and sends rooms no rule decided to the Layer 2 triage queue (`POST /api/v1/auto-resolve/queue`).
- **Layer 2 agent**: not in this repo (swappable). Build guide: [`docs/LAYER2_AGENT_GUIDE.md`](docs/LAYER2_AGENT_GUIDE.md).

## Setup
```bash
npm install
cp .env.example .env
# Edit .env with SMLLINECRM_API_URL and SMLLINECRM_API_KEY
```

## Run Layer-1 Worker
```bash
# Dry-run once (reads monitor + messages, makes zero writes)
npm run check:layer1 -- --dry-run

# Single pass (submits matching conversations to SMLLineCRM Review queue / Auto mode)
npm run check:layer1

# Continuous polling every POLL_INTERVAL_SEC seconds (default 1800 = 30 min)
npm run worker:layer1
```

## Run in production (Docker)
CI builds `ghcr.io/smlsoft/smllinecrm-worker:latest` from this folder. The `worker` service in the
repo-root `docker-compose.yml` runs it next to the backend (`SMLLINECRM_API_URL=http://backend:3001`,
`SMLLINECRM_API_KEY` = the backend's `API_KEY`). It runs `node dist/worker/run-layer1.js --loop`.
In loop mode it also listens on `TRIGGER_PORT` (default 3005, docker network only): `POST /run` starts a
pass in the background (or joins the running one) and returns 202; `GET /status` reports `running` and the
last summary. Both need `X-API-Key`. The backend calls them for the refresh button when `LAYER1_WORKER_URL`
is set (e.g. `http://worker:3005`).

## Run MCP Server (stdio)
```bash
npm run build
npm start
```

Example MCP client config:
```json
{
  "mcpServers": {
    "smllinecrm": {
      "command": "node",
      "args": ["<path-to-SMLLineCRM>/line-kpi-mcp/dist/index.js"],
      "env": {
        "SMLLINECRM_API_URL": "http://localhost:3001",
        "SMLLINECRM_API_KEY": "your-api-key-here",
        "MCP_READ_ONLY": "true"
      }
    }
  }
}
```

## Test
```bash
npm test
```
