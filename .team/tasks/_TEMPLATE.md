# Task NNN: <title>

Copy this file to `.team/tasks/NNN-<slug>.md`. Scripts read the lines that start with
`GOAL:`, `MODE:` (do, review or explore), `FILES:` and `DONE-WHEN:` - keep each on ONE line.
`team-start` refuses a field that is missing, empty, invalid or still a `<...>` placeholder
(`FILES:` is read only for `do`).

GOAL: <one sentence: what must be true afterwards>
MODE: do
FILES: <space-separated repo-relative paths; a directory ends with "/"; e.g. src/auth/ tests/auth.test.js>
DONE-WHEN: <checks a stranger could run, with the expected result>

## Notes
<anything the head needs that is not obvious from the files>

## Shared contract (only for linked tasks that must agree with each other)
<the interface both sides rely on: names, shapes, formats. Delete this section otherwise.>
