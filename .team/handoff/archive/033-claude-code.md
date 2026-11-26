## claude-code · task 033 · CLAIMED

- **did:** claimed task 033 - `ConversationResolver.resolve()` never throws because another message of the same LINE group opened a thread outside this message's gap window at the same moment; it starts over and returns a conversation.
- **files touched:** none yet (claimed: line-kpi-system/src/processors/ConversationResolver.ts)
- **decided:** none
- **not checked:** nothing has been done yet
- **next:** start at .team/tasks/033-resolver-retry-not-drop.md

## claude-code · task 033 · DONE

- **did:** `ConversationResolver.resolve()` runs its find / close-older / create steps in a loop of up to 5 attempts and starts over when the unique open-conversation index refuses the create, instead of rethrowing after one look. Checked on a scratch local MongoDB database with concurrent `resolve()` calls for groups with no open thread: timestamps 5 hours apart, 40 rounds: 23 of 80 calls threw before, 0 after, one open conversation per group; three messages 5 hours apart, 20 rounds: 26 of 60 threw before, 0 after; 0.5 s apart, 20 rounds: both calls share one conversation, before and after. `npx tsc --noEmit` in `line-kpi-system` exits 0.
- **files touched:** line-kpi-system/src/processors/ConversationResolver.ts docs/STATUS.md
- **decided:** none
- **not checked:** `MessageProcessor.process` end to end with real webhook calls; behaviour on the production cluster; more than three concurrent messages; `line-kpi-admin` and `line-kpi-mcp` (not touched)
- **next:** start at line-kpi-system/src/processors/ConversationResolver.ts:44 - deploy the backend image and watch the backend log for `[Handler] Error processing event`
