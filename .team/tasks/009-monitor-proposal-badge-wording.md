# Task 009: Monitor proposal badge does not claim AI

GOAL: The monitor badge for a conversation with a pending auto-resolve proposal no longer says "AI" or shows the bot icon, because the proposal may come from a Layer 1 rule; the two queue badges that really involve the Layer 2 agent keep their AI wording.
MODE: do
FILES: line-kpi-admin/src/app/(dashboard)/monitor/
DONE-WHEN: (cd line-kpi-admin && npx tsc --noEmit && npm run lint) exit 0 with no new warnings, and `grep -n "AI เสนอปิด" -r line-kpi-admin/src` prints nothing
## Notes
- User report: a Layer 1 rule proposal shows "AI เสนอปิด" (`line-kpi-admin/src/app/(dashboard)/monitor/page.tsx:48`) although no AI agent is connected.
- `resolved_pending_review` comes from any `pending_review` AutoResolveLog, rule or AI (`line-kpi-system/src/api/routes/monitorRoutes.ts`, `attachTriageStatus`), so the wording must be layer-neutral. The Auto-Resolve page already shows the layer.
- Not touched: backend, `.env.local`, `.next/`.
