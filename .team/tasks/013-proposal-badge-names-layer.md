# Task 013: Monitor proposal badge names who proposed the close

GOAL: On `/monitor`, a room with a pending close proposal says who proposed it: "ชั้นที่ 1 เสนอปิด" for a Layer 1 rule, "AI เสนอปิด" for the Layer 2 AI, and both read "รอยืนยัน" (waiting for a person to confirm) instead of the unclear "เสนอปิด · รอตรวจ".
MODE: do
FILES: line-kpi-system/src/api/routes/monitorRoutes.ts line-kpi-admin/src/types/api.ts line-kpi-admin/src/app/(dashboard)/monitor/page.tsx
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-system and line-kpi-admin, and against a LOCAL MongoDB `GET /api/v1/monitor` returns `triageLayer: 'rule'` for a room whose pending_review log has layer rule and `'ai'` for layer ai, and the monitor page shows the matching badge text for each
## Notes
- Requested by the user after seeing "เสนอปิด · รอตรวจ" on both a Layer 1 sticker_only proposal and a Layer 2 AI 85% proposal.
- `triageStatus` values stay the same; `triageLayer` is added beside it so nothing else that reads the status changes.
- A group with both kinds shows the AI badge.
