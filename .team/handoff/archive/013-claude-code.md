## claude-code · task 013 · CLAIMED

- **did:** claimed task 013 - On `/monitor`, a room with a pending close proposal says who proposed it: "ชั้นที่ 1 เสนอปิด" for a Layer 1 rule, "AI เสนอปิด" for the Layer 2 AI, and both read "รอยืนยัน" (waiting for a person to confirm) instead of the unclear "เสนอปิด · รอตรวจ".
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/monitor/page.tsx line-kpi-admin/src/types/api.ts line-kpi-system/src/api/routes/monitorRoutes.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/013-proposal-badge-names-layer.md

## claude-code · task 013 · DONE

- **did:** `GET /api/v1/monitor` returns `triageLayer` (`rule` | `ai` | null) beside `triageStatus` for each pending conversation and its group (`line-kpi-system/src/api/routes/monitorRoutes.ts`); the monitor badge reads "ชั้นที่ 1 เสนอปิด · รอยืนยัน" for a rule proposal and "AI ตรวจแล้ว เสนอปิด · รอยืนยัน" (Bot icon) for an AI proposal.
- **files touched:** line-kpi-system/src/api/routes/monitorRoutes.ts line-kpi-admin/src/types/api.ts line-kpi-admin/src/app/(dashboard)/monitor/page.tsx
- **decided:** `triageStatus` values unchanged; layer is a separate field. When rule and AI proposals both exist (same snapshot or same group), AI wins.
- **not checked:** production data; dark mode; the `/auto-resolve` page (unchanged).
- **next:** none
