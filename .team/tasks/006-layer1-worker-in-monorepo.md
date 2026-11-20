# Task 006: Layer 1 worker and MCP server move into the monorepo and deploy as a container

GOAL: The Layer 1 worker and MCP server live in `line-kpi-mcp/` of this repo, CI builds `ghcr.io/smlsoft/smllinecrm-worker`, and `docker-compose.yml` runs it next to the backend so urgent rooms are checked every 30 minutes in production.
MODE: do
FILES: line-kpi-mcp/ .github/workflows/deploy.yml docker-compose.yml docs/direction.md docs/adr/ AGENTS.md .team/setup.sh
DONE-WHEN: (cd line-kpi-mcp && npm ci && npx tsc --noEmit && npm test) passes all tests; `docker build line-kpi-mcp` succeeds; the built image, run with `SMLLINECRM_API_URL` pointing at a backend on a LOCAL MongoDB (never Atlas) holding one urgent unanswered conversation, logs a Layer 1 pass and that conversation appears as a pending item in `triagequeueitems`; `docker compose -f docker-compose.yml config` succeeds

## Notes
- User decision: the Layer 1 worker and MCP server are deterministic code, not an AI agent, so they belong in this repo. Only the Layer 2 AI agent stays outside and swappable. Record it as an ADR and reword the auto-resolve line in `docs/direction.md` accordingly.
- Source: `../smllinecrm-mcp` tracked files at commit c79bdb2 (src, test, package.json, package-lock.json, tsconfig.json, README.md, .env.example, .gitignore, docs/LAYER2_AGENT_GUIDE.md). Do not copy `docs/LAYER2_AGENT_PLAN.md` (another session owns it), `node_modules`, `dist`, `.env`.
- Container runs `worker:layer1` compiled (no tsx at runtime). In compose it reaches the backend at `http://backend:3001`; its API key equals the backend's `API_KEY`.
- `deploy.yml` only builds and pushes images (direction.md Forbidden); add the worker image build next to the other two.
- Not touched: `.env`, `.env.local`, `line-kpi-system/`, `line-kpi-admin/`, the server's real compose file (the user copies the new service there and sets the key).
