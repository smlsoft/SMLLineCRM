## claude-code · task 032 · CLAIMED

- **did:** claimed task 032 - Two messages that reach `ConversationResolver.resolve()` at the same moment for a LINE group with no active thread end up in one open conversation, and a script merges the duplicate open conversations that already exist.
- **files touched:** none yet (claimed: line-kpi-system/src/models/Conversation.ts line-kpi-system/src/processors/ConversationResolver.ts line-kpi-system/src/scripts/merge-duplicate-open-conversations.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/032-one-open-conversation-per-group.md

## claude-code · task 032 · DONE

- **did:** `ConversationResolver.resolve()` closes only open threads older than the gap window and, when the new partial unique index (`lineGroupId`, `status: 'open'`) refuses its create, returns the thread the concurrent message opened. Added `merge-duplicate-open-conversations.ts` (dry-run by default): per group it keeps the newest open conversation, merges open siblings within the gap window into it (messages, audit logs, triage items; counters and last-message times rebuilt from messages; sibling deleted) and closes older open ones. Checked on a scratch local MongoDB database: 20 rounds of two concurrent `resolve()` calls gave 20 splits with the old code and 0 with the new; on a seeded copy of the production case the index build failed before the script, the dry-run changed nothing, `--apply` left one open conversation with 11 messages (6 customer, 5 employee, correct last times) and the index then built; `npx tsc --noEmit` in `line-kpi-system` exits 0.
- **files touched:** line-kpi-system/src/processors/ConversationResolver.ts line-kpi-system/src/models/Conversation.ts line-kpi-system/src/scripts/merge-duplicate-open-conversations.ts docs/STATUS.md
- **decided:** one open conversation per LINE group is enforced by a database index, not by code alone
- **not checked:** the script on production data (how many groups have duplicates is unknown); `MessageProcessor.process` end to end with two real webhook calls; Mongoose index build on the production Atlas cluster; `line-kpi-admin` and `line-kpi-mcp` checks (not touched)
- **next:** start at line-kpi-system/src/scripts/merge-duplicate-open-conversations.ts:90 - run the dry-run on production and have the owner read it before `--apply` and before deploying the image
