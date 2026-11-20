## claude-code · task 009 · CLAIMED

- **did:** claimed task 009 - The monitor badge for a conversation with a pending auto-resolve proposal no longer says "AI" or shows the bot icon, because the proposal may come from a Layer 1 rule; the two queue badges that really involve the Layer 2 agent keep their AI wording.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/monitor/)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/009-monitor-proposal-badge-wording.md

## claude-code · task 009 · DONE

- **did:** monitor badge for `resolved_pending_review` now reads "เสนอปิด · รอตรวจ" with a clipboard icon and a tooltip naming both layers; the two queue badges keep "AI" and the bot icon (`line-kpi-admin/src/app/(dashboard)/monitor/page.tsx`, `TRIAGE_CONFIG`).
- **files touched:** line-kpi-admin/src/app/(dashboard)/monitor/page.tsx
- **decided:** layer-neutral wording instead of passing the layer from the backend; the Auto-Resolve page already shows the layer.
- **not checked:** the badge in a browser (text and icon change only); production.
- **next:** none
