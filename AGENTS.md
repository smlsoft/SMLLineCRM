# AGENTS.md

Team rules come from the global rules (`GLOBAL.md`, read by your app) and the `team-flow` skill.
This file adds project facts and never overrides them. If your app did not load `team-flow`:
`d=$(dirname "$(readlink "$(command -v team-start)")")`, then open `$d/../skills/team-flow/SKILL.md`.

## Project facts

- Stack: Node.js + TypeScript 5.5 + Express 4 + Mongoose 8 (`line-kpi-system/`), Next.js 14.2 App Router + React 18 + Tailwind CSS 3 + shadcn/ui (`line-kpi-admin/`), MongoDB.
- Test command: `(cd line-kpi-system && npx tsc --noEmit) && (cd line-kpi-admin && npx tsc --noEmit && npm run lint)` (no automated test suite exists).
- Do not touch: `line-kpi-system/.env`, `line-kpi-admin/.env.local`, `line-kpi-system/dist/`, `line-kpi-admin/.next/`.
- Fresh-worktree setup: `.team/setup.sh` symlinks `node_modules` for `line-kpi-system` and `line-kpi-admin` from the main checkout; `team-start` runs it automatically.
- Dashboard permissions: every new page under `line-kpi-admin/src/app/(dashboard)/` must update the 5 permission locations listed in `CLAUDE.md:101`.
