# Task 001: Reset responseStatusOverride on incoming customer message

GOAL: Clear Conversation.responseStatusOverride to null whenever a customer message is processed so new customer questions reopen waiting/slow status on Monitor.
MODE: do
FILES: line-kpi-system/src/processors/MetricsUpdater.ts
DONE-WHEN: grep -n "responseStatusOverride = null" line-kpi-system/src/processors/MetricsUpdater.ts matches inside the customer branch and (cd line-kpi-system && npx tsc --noEmit) exits 0

## Notes
In `line-kpi-system/src/processors/MetricsUpdater.ts:38`, customer messages update `lastCustomerMessageAt` without clearing `responseStatusOverride`. Because `monitorRoutes.ts:115` and `conversationRoutes.ts:106` give `responseStatusOverride === 'normal'` highest precedence, any conversation marked Resolved stays green even if the customer asks a new question within the 4-hour gap window.
