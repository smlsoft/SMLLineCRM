# Task 033: Resolver retries instead of dropping a message

GOAL: `ConversationResolver.resolve()` never throws because another message of the same LINE group opened a thread outside this message's gap window at the same moment; it starts over and returns a conversation.
MODE: do
FILES: line-kpi-system/src/processors/ConversationResolver.ts
DONE-WHEN: `(cd line-kpi-system && npx tsc --noEmit)` exits 0, and against a scratch database on the local MongoDB: 40 rounds of two concurrent `resolve()` calls whose timestamps are 5 hours apart, for a group with no open thread, give no error and exactly one open conversation per group; 20 rounds with timestamps 0.5 s apart still give one conversation shared by both calls.

## Notes
- Before this task the later message lost the race in about a third of such calls: its create hit the unique open-conversation index, no thread lay inside its gap window, the error reached the webhook handler, which only logs, and the message was not stored.
- Starting over gives the result sequential arrival gives: the older thread is closed and the later message opens a new one.
