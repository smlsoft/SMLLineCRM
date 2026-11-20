## claude-code · task 007 · CLAIMED

- **did:** claimed task 007 - On `/auto-resolve`, each entry's chat snapshot box shows its newest message first visible (scrolled to the bottom) when it renders, and the user can still scroll up freely.
- **files touched:** none yet (claimed: line-kpi-admin/src/app/(dashboard)/auto-resolve/)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/007-snapshot-scroll-bottom.md

## claude-code · task 007 · DONE

- **did:** the chat snapshot on `/auto-resolve` now opens scrolled to its newest message (`ScrollToBottomBox` in `line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx`); it scrolls only when the entry or its message count changes.
- **files touched:** line-kpi-admin/src/app/(dashboard)/auto-resolve/page.tsx
- **decided:** none
- **not checked:** production; very short snapshots (no overflow, nothing to scroll). Verified in a browser against local MongoDB `line_kpi_local` with a 14-message entry: at bottom on load, after switching to history and back, and a manual scroll to top stayed put for 3 s. The test entry was deleted.
- **next:** none
