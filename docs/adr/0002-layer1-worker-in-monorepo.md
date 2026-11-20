# 0002 Layer 1 worker and MCP server live in the monorepo

## Decision
The deterministic Layer 1 worker and the MCP server live in `line-kpi-mcp/` of this repo. CI builds
`ghcr.io/smlsoft/smllinecrm-worker` and the `worker` service in `docker-compose.yml` runs the worker
next to the backend. Only the Layer 2 AI agent stays outside the repo and swappable.

## Why
- The system does not work without the worker: in a separate repo it was never deployed, so nothing
  filled the review or triage queue in production.
- The worker and backend share the auto-resolve API contract; one repo lets one PR change both.
- The existing image build and compose deploy cover it with one more step and service.
- The worker uses no AI, so the reason to keep the triage agent outside does not apply to it.

## Rejected
- A separate `smlsoft/smllinecrm-mcp` repository: second deploy pipeline, contract drift, easy to forget.
