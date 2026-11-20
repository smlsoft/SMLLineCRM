# Task 007: Auto-resolve chat snapshot opens at the newest message

GOAL: On `/auto-resolve`, each entry's chat snapshot box shows its newest message first visible (scrolled to the bottom) when it renders, and the user can still scroll up freely.
MODE: do
FILES: line-kpi-admin/src/app/(dashboard)/auto-resolve/
DONE-WHEN: (cd line-kpi-admin && npx tsc --noEmit && npm run lint) exit 0, and in a browser on `/auto-resolve` against a LOCAL MongoDB an entry whose snapshot overflows the box shows its last message at the bottom of the box (`scrollTop + clientHeight == scrollHeight`) on load and after switching tabs
## Notes
- User request: the box with `max-h-56 overflow-y-auto` (`line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx:473`) starts at the top, so the latest message is hidden.
- Scroll once per snapshot render, not on every re-render, so it never fights a user who scrolled up.
- Not touched: `.env.local`, `.next/`, backend.
