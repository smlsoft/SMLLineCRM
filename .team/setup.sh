#!/bin/bash
set -euo pipefail
for pkg in line-kpi-system line-kpi-admin line-kpi-mcp; do
  if [ -d "${TEAM_MAIN_CHECKOUT}/${pkg}/node_modules" ] && [ ! -e "${TEAM_WORKTREE}/${pkg}/node_modules" ]; then
    ln -s "${TEAM_MAIN_CHECKOUT}/${pkg}/node_modules" "${TEAM_WORKTREE}/${pkg}/node_modules"
  fi
done
