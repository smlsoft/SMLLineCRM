# Task 014: Proposal badge drops the "รอยืนยัน" suffix

GOAL: The monitor proposal badge reads only "ชั้นที่ 1 เสนอปิด" or "AI ตรวจแล้ว เสนอปิด"; the "· รอยืนยัน" suffix goes, because auto mode will apply proposals without a person confirming.
MODE: do
FILES: line-kpi-admin/src/app/(dashboard)/monitor/page.tsx
DONE-WHEN: `npx tsc --noEmit` exits 0 in line-kpi-admin and neither badge label in `monitor/page.tsx` contains "รอยืนยัน"
## Notes
- Requested by the user right after task 013.
- Hover titles keep saying a person confirms on `/auto-resolve`, which is true in review mode.
