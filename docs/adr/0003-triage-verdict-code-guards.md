# 0003 Deterministic code guards on Layer 2 triage verdicts

## Decision
The backend applies deterministic guards to Layer 2 AI triage input and output in
`line-kpi-system/src/api/routes/autoResolveRoutes.ts`:
- `POST /queue/claim` returns `conversation.minutesSinceLastCustomerMessage` (whole minutes from the
  customer's last message to the claim time), so the agent never computes silence itself.
- `POST /queue/:id/complete` stores a `resolved` verdict as `needs_reply` when the customer's latest
  message is `image`, `file`, `video`, `audio` or `location` (not `sticker`, not `other`). The stored
  reason starts with `ระบบเปลี่ยนเป็นต้องตอบ: ลูกค้าส่งรูป/ไฟล์เป็นข้อความล่าสุด` followed by the AI's
  reason; the response is 200 with `overridden: true`.
Guards may only turn `resolved` into `needs_reply`, never the reverse.

## Why
- Dry runs over a 71-room eval set kept producing 1-2 wrong closures per run however the instruction
  was worded: rooms where staff asked for something and the customer answered with an image, and
  silence miscalculated by the model. Precomputed minutes removed the second error in tests.
- A missed reply angers a customer; an extra alert costs little, so the guard is one-directional.
- Code is deterministic and stays in place when the swappable agent or its model changes.

## Rejected
- More instruction wording only: measured to keep failing on the same rooms.
- Guards inside the external agent: lost whenever the agent is swapped (direction: agent stays swappable).
