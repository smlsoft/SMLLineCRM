# Task 008: Auto-resolve cards fit the screen width and show chats like LINE

GOAL: On `/auto-resolve` the number of entry cards per row grows with the screen width (one on a phone, three or more on a wide desktop), and each chat snapshot reads like a LINE chat: customer bubbles on the left with name and avatar initial, staff bubbles on the right in green, time beside each bubble, a date divider when the day changes, and media shown as labelled icons.
MODE: do
FILES: line-kpi-admin/src/app/(dashboard)/auto-resolve/
DONE-WHEN: (cd line-kpi-admin && npx tsc --noEmit && npm run lint) exit 0 with no new warnings, and in a browser on `/auto-resolve` against a LOCAL MongoDB the card grid shows 1 column at 375 px wide, at least 3 at 1920 px wide, no horizontal page scroll at either width, and a snapshot with customer and staff messages across two days shows left/right bubbles, one date divider per day, and still opens at the newest message (task 007)
## Notes
- User request: today `grid-cols-1 xl:grid-cols-2` (`line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx:404` and `:425`) gives only 2 cards per row on a wide screen.
- Snapshot messages carry only `senderType, senderDisplayName, messageType, textContent?, timestamp`; no media URL, so media stays a label.
- Keep the review actions, reason banner and badges unchanged. Icons from `lucide-react`, `cn()` for classes, `rounded-xl`/`rounded-3xl` only (`line-kpi-admin/CLAUDE.md`).
- Not touched: `.env.local`, `.next/`, backend.
