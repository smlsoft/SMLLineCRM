## claude-code · task 008 · CLAIMED

- **did:** claimed task 008 - On `/auto-resolve` the number of entry cards per row grows with the screen width (one on a phone, three or more on a wide desktop), and each chat snapshot reads like a LINE chat: customer bubbles on the left with name and avatar initial, staff bubbles on the right in green, time beside each bubble, a date divider when the day changes, and media shown as labelled icons.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/auto-resolve/)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/008-auto-resolve-line-layout.md

## claude-code · task 008 · DONE

- **did:** `/auto-resolve` card grid uses `repeat(auto-fill, minmax(min(100%,22rem),1fr))` (cards per row follow screen width); chat snapshot moved to `line-kpi-admin/src/app/(dashboard)/auto-resolve/ChatSnapshot.tsx` in LINE style: customer left with avatar initial and name, staff right in green, time beside each bubble, one divider per day, media as icon + Thai label; still opens at the newest message.
- **files touched:** line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx line-kpi-admin/src/app/(dashboard)/auto-resolve/ChatSnapshot.tsx
- **decided:** staff bubble uses Tailwind `emerald-500` (LINE-like green), as the page already uses palette classes for layer badges.
- **not checked:** dark mode appearance; production. Verified in a browser against local MongoDB `line_kpi_local` with 5 test entries (deleted after): 1920 px → 4 columns, 375 px → 1 column, no horizontal scroll, two day dividers, bubbles on the expected sides, opens at the bottom.
- **next:** none
