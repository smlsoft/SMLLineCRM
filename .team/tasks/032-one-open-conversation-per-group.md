# Task 032: One open conversation per LINE group

GOAL: Two messages that reach `ConversationResolver.resolve()` at the same moment for a LINE group with no active thread end up in one open conversation, and a script merges the duplicate open conversations that already exist.
MODE: do
FILES: line-kpi-system/src/processors/ConversationResolver.ts line-kpi-system/src/models/Conversation.ts line-kpi-system/src/scripts/merge-duplicate-open-conversations.ts
DONE-WHEN: `(cd line-kpi-system && npx tsc --noEmit)` exits 0, and against a scratch database on the local MongoDB: 20 rounds of two concurrent `resolve()` calls for a new group each leave exactly one conversation; the script without `--apply` lists a seeded duplicate pair and changes nothing; with `--apply` the pair becomes one open conversation that holds every message with correct counters and last-message times, and the unique index `{ lineGroupId: 1 }` (partial, `status: 'open'`) then builds.

## Notes
- Seen in production: a customer's text and image arrived in the same second after a gap of more than 4 hours; each opened a conversation, later messages went to the newer one, and the first stayed open with one unanswered message, so Layer 1 and Layer 2 reported "no staff reply" on a room staff had answered.
- The partial unique index cannot build while duplicate open conversations exist, so the script runs on production (dry-run, then `--apply` after the owner reads the output) before the new image is deployed.
- The script never runs against production from a dev machine; tests use a scratch database name.
- Closed one-message conversations left by the same race are not merged here.
