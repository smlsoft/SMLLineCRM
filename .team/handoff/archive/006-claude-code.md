## claude-code · task 006 · CLAIMED

- **did:** claimed task 006 - The Layer 1 worker and MCP server live in `line-kpi-mcp/` of this repo, CI builds `ghcr.io/smlsoft/smllinecrm-worker`, and `docker-compose.yml` runs it next to the backend so urgent rooms are checked every 30 minutes in production.
- **files touched:** none yet (claimed: .github/workflows/deploy.yml .team/setup.sh AGENTS.md docker-compose.yml docs/adr/ docs/direction.md line-kpi-mcp/)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/006-layer1-worker-in-monorepo.md

## claude-code · task 006 · DONE

- **did:** moved the Layer 1 worker and MCP server from `../smllinecrm-mcp` (commit c79bdb2) into `line-kpi-mcp/`; added `line-kpi-mcp/Dockerfile` (compiled, runs `--loop` as user `node`), a worker image step in `.github/workflows/deploy.yml`, a `worker` service in `docker-compose.yml`; ADR 0002; reworded `docs/direction.md`; `AGENTS.md` and `.team/setup.sh` know the new folder.
- **files touched:** line-kpi-mcp/ .github/workflows/deploy.yml docker-compose.yml docs/direction.md docs/adr/0002-layer1-worker-in-monorepo.md AGENTS.md .team/setup.sh
- **decided:** package renamed `line-kpi-mcp`; `enqueuedBy` stays `smllinecrm-mcp/layer1` (stored identifier, tests rely on it).
- **not checked:** the CI build on GitHub; the server's real compose file (the user adds the `worker` service and sets `SMLLINECRM_API_KEY`); `docs/LAYER2_AGENT_PLAN.md` stays in `../smllinecrm-mcp` (owned by another session). Verified: 22/22 tests, tsc, `docker compose config`, and the built image queued one urgent room against a backend on a scratch local MongoDB (`line_kpi_t006`, dropped).
- **next:** the user pushes main, adds the `worker` service on the server, pulls and starts it.
