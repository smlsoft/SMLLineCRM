# Layer 2 AI Agent — Build Guide

Hand this file to whoever builds the Layer 2 agent. It is self-contained.

## 1. What the agent does

Every 30 minutes the Layer 1 worker (`npm run worker:layer1` in this repo) looks at **urgent**
conversations in SMLLineCRM — a customer has waited more than 15 minutes with no staff reply.
Rooms that a Layer 1 rule can close (sticker only, "ขอบคุณครับ" after a staff reply…) are closed by
rule. **Every other urgent room is ambiguous and is put in the triage queue.**

The Layer 2 agent:

1. claims one queued room,
2. reads its recent messages,
3. decides one verdict:
   - `resolved` — no reply is needed (conversation is finished, the customer only acknowledged, it was answered elsewhere…)
   - `needs_reply` — the customer still waits for staff
4. reports the verdict, then claims the next room until the queue is empty.

Effect in SMLLineCRM:

| Verdict | Mode `review` (current) | Mode `auto` |
|---|---|---|
| `resolved` | entry waits on the `/auto-resolve` page for a human; monitor badge "AI เสนอปิด" | conversation is marked normal immediately; entry in the audit log |
| `needs_reply` | monitor badge "ยังไม่ได้ตอบ" | same |

Every decision is kept in the audit log; the owner reads it later. The agent never chooses the mode.

The goal is fast alerting: a room should get its verdict within the same 30-minute cycle.

## 2. What the agent needs

| Need | Value |
|---|---|
| Backend URL | Production API on the DigitalOcean server, port `3102` (local dev: `http://localhost:3001`). **Check that the agent host can reach it**; this was not verified. |
| API key | Header `X-API-Key`. Set it as an environment variable on the agent host (`SMLLINECRM_API_KEY`). Never paste it in chat, code or git. |
| Agent id | Any stable string ≤ 64 chars, e.g. `layer2-agent-1`. Shown in the audit log as `proposedBy`. |
| LLM | Owner's choice (provider, model, key). Not decided yet. |

## 3. API contract

Base: `<backend>/api/v1/auto-resolve`. All requests: `Content-Type: application/json`, `X-API-Key`.
Source of truth: `SMLLineCRM/.team/tasks/003-triage-queue.md` and
`SMLLineCRM/line-kpi-system/src/api/routes/autoResolveRoutes.ts`.

### Claim — `POST /queue/claim`

```json
{ "agentId": "layer2-agent-1", "leaseSeconds": 300 }
```

- `204` (no body): queue is empty → sleep, then try again.
- `200`:

```json
{
  "item": { "_id": "…", "conversationId": "…", "lastMessageAtSnapshot": "2026-11-20T02:15:54.605Z",
            "status": "claimed", "attempts": 1, "enqueueReason": "ยังไม่มีพนักงานตอบในแชทล่าสุด",
            "leaseUntil": "…" },
  "conversation": { "_id": "…", "customerGroupId": "…", "lineGroupId": "…", "status": "open",
                    "lastCustomerMessageAt": "…", "lastEmployeeMessageAt": "…", "lastMessageAt": "…" },
  "messages": [
    { "_id": "…", "senderType": "customer", "senderDisplayName": "ลูกค้า A", "messageType": "text",
      "textContent": "สินค้าส่งวันไหนคะ", "timestamp": "…" }
  ]
}
```

- `messages`: last 30 of the conversation, oldest first. Staff messages may carry
  `employeeId: { _id, name, employeeCode }`; media messages may carry `mediaId: { url, mimeType }`; absent otherwise. `messageType` is one of
  `text, image, sticker, file, audio, video, location, other`. No media bytes are sent.
- The lease (default 300 s, 30–1800) is yours. Finish or release before `leaseUntil`. If the lease
  runs out, another agent may take the item and your `complete` gets `409`.
- Rooms that became stale (staff replied, customer wrote again, room closed) are skipped by the
  server; you only get live ones.

### Complete — `POST /queue/:id/complete`

```json
{ "agentId": "layer2-agent-1", "verdict": "needs_reply",
  "reason": "ลูกค้าถามวันส่งสินค้า ยังไม่มีพนักงานตอบ", "confidence": 0.9 }
```

- `verdict`: `resolved` | `needs_reply`. `reason`: required, ≤ 500 chars, Thai, one line a manager can read.
  `confidence`: optional 0–1.
- Optional `snapshotMessages` (for `resolved`): up to 15 `{senderType, senderDisplayName, messageType, textContent?, timestamp}`
  that justify the verdict; stored in the audit log.
- `200` / `201`: done. For `resolved` the body is the same as `/propose`
  (`mode`, `status: pending_review | auto_resolved`, `log`), or `skipped: …` if the room changed meanwhile.
- `409`: lease lost or item expired → drop it, claim the next one.
- `400`: bad body → a bug in the agent; release the item with the error.

### Release — `POST /queue/:id/release`

```json
{ "agentId": "layer2-agent-1", "error": "LLM timeout after 30s" }
```

Use when the agent cannot decide (LLM error, timeout, invalid output). The item goes back to the
queue. After **3 attempts** it is marked `failed` and no one gets it again.

### Item states

`pending` → `claimed` → `done` (verdict stored) | `pending` (released) | `failed` (3 attempts) | `expired` (room changed).

## 4. Agent loop (reference)

```
loop forever:
  claimed = POST /queue/claim
  if 204: sleep 60 s; continue
  try:
    verdict = decide(claimed.messages, claimed.item.enqueueReason)   # LLM call, timeout < lease
    POST /queue/{id}/complete { agentId, verdict, reason, confidence }
    (409 → ignore, continue)
  except error:
    POST /queue/{id}/release { agentId, error }
```

- Run one agent process first. Several can run in parallel safely: a claim is atomic.
- Keep each LLM call well under the lease (e.g. 60 s timeout with a 300 s lease).
- Log every claim/verdict/release with the item id. Never log the API key.

## 5. Decision guide for the LLM

Give the model the messages and ask for strict JSON: `{"verdict": "resolved" | "needs_reply", "reason": "<Thai, one line>", "confidence": 0..1}`.
Reject any other output (→ release).

Decide **`needs_reply`** when the latest customer messages contain any of:
- a question or request (สอบถาม, ขอ, รบกวน, ช่วย, เช็ค, ได้ไหม, ยังไง, เมื่อไหร่, ?)
- a complaint or problem report (ไม่ได้, error, เสีย, ช้า, ยังไม่ได้รับ)
- an image, file, video or location sent after the last staff reply (usually evidence that needs an answer)
- no staff reply at all in the conversation

Decide **`resolved`** only when the customer's latest messages clearly end the topic:
- thanks/acknowledgement after a staff answer, possibly mixed with short words or emoji
- the customer says it is solved (ได้แล้ว, เรียบร้อย, ไม่เป็นไร, แก้ได้แล้ว)
- a message clearly not addressed to staff (customers chatting among themselves) — mention it in `reason`

When unsure → `needs_reply`. A missed reply angers a customer; an extra alert costs little.
Keep `confidence` honest; the owner uses it when reading the log.

Layer 1 already closes plain stickers and simple closing phrases after a staff reply, so what reaches
the agent is mostly real questions and mixed messages.

## 6. Testing before production

1. Run SMLLineCRM locally against a **local MongoDB only** (never the production Atlas database):
   ```bash
   docker start smllinecrm-mongo-local   # or: docker run -d --name smllinecrm-mongo-local -p 127.0.0.1:27017:27017 mongo:7
   cd SMLLineCRM/line-kpi-system && MONGODB_URI=mongodb://127.0.0.1:27017/line_kpi_local npm run dev
   ```
2. Insert test conversations (open, `lastCustomerMessageAt` > 15 min ago) and their messages.
3. Fill the queue: `npm run check:layer1` in this repo with `SMLLINECRM_API_URL=http://localhost:3001`.
4. Run the agent; check the `/monitor` badges and `/auto-resolve` entries in the admin UI (`http://localhost:3000`).
5. In production keep mode **`review`** until the verdicts on `/auto-resolve` look right, then switch to `auto` there.

## 7. Optional: drive it through MCP

This repo's MCP server exposes the same queue as tools (`claim_triage_item`, `complete_triage_item`,
`release_triage_item`) plus read tools. An MCP-capable agent can use them instead of raw HTTP.
For a chat assistant that only answers questions ("who answered what today, how many jobs"), run the
server with `MCP_READ_ONLY=true` so it cannot write.

## 8. Not done yet

- LINE push alerts (monitor page only today).
- The agent itself, its host, its LLM choice.
- Production reachability of port `3102` from the agent host.
