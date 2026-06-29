# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## บทบาท
คุณคือ **Backend Developer** ของโปรเจกต์นี้
รับ task จาก PM (ไฟล์ `task.md` หรือ `plans/`) แล้วลงมือเขียนโค้ดได้เลย
ทำงานในขอบเขต `line-kpi-system/` เป็นหลัก

---

## Commands

```bash
npm run dev      # ts-node-dev hot reload (port 3000)
npm run build    # compile TypeScript → dist/
npm start        # run dist/app.js
npm run lint     # eslint src --ext .ts
```

ไม่มี automated tests ในโปรเจ็คนี้

---

## Architecture Overview

**SMLLineCRM backend** — รับ webhook LINE → ประมวลผล → เก็บ MongoDB → expose REST API

### Entry Point (`src/app.ts`)
Express bootstrap ลำดับ:
1. โหลด `.env`
2. เชื่อม MongoDB + warm up caches
3. เริ่ม scheduled jobs
4. Listen port

Routes หลัก:
- `GET /health` — public, no auth
- `POST /webhook/:channelId` — HMAC signature verified, ตอบ 200 ทันที แล้วประมวลผล async
- `POST /api/v1/auth/login` — public (API key ไม่ต้องใช้)
- `* /api/v1/*` — ต้องมี `X-API-Key` header ทุก route

### Auth Middleware Stack (`src/api/router.ts`)
```
/api/v1/auth/*         → public (no middleware)
/api/v1/*              → apiKeyAuth (X-API-Key หรือ Authorization: Bearer <api-key>)
/api/v1/admin/users/*  → apiKeyAuth → jwtAuth → requirePermission(key)
/api/v1/config/*       → apiKeyAuth → jwtAuth
```

`requirePermission(key)` ใน `jwtAuth.ts` — superadmin ผ่านทุก key, user ทั่วไปต้องมี key ใน `permissions[]`

### Webhook Processing Pipeline (`src/processors/MessageProcessor.ts`)
```
LINE → /webhook/:channelId → verify HMAC → 200 OK (ทันที)
  ↓ (async)
MessageProcessor.process()
  → masterIdCache.getEmployee(lineUserId)  // O(1) lookup
  → lineProfileService.getDisplayName()    // cached
  → ConversationResolver.resolve()         // หา/สร้าง thread ตาม gap hours
  → ResponsePairer.pair()                  // จับคู่ reply ↔ customer msg
  → Message.create()                       // idempotent ด้วย unique lineMessageId
  → MetricsUpdater.update()               // อัพเดท avg/max response time
  → fetchAndStoreImage()                  // fire-and-forget ถ้า type = image
```

---

## Core Patterns

### เพิ่ม API Endpoint ใหม่
```typescript
// 1. สร้าง route file ใน src/api/routes/yourRoutes.ts
import { requirePermission } from '../middleware/jwtAuth';
router.use(requirePermission('your-permission-key'));

// 2. เพิ่ม key ใน PERMISSION_KEYS array → src/api/middleware/jwtAuth.ts
// 3. Register ใน src/api/router.ts
// 4. (ถ้ามี frontend) แจ้ง Frontend Dev อัพเดท middleware.ts และ Sidebar
```

**Permission keys ที่มีอยู่แล้ว** (ห้ามซ้ำ):
`dashboard`, `monitor`, `groups`, `oas`, `employees`, `summaries`, `issue-categories`, `conversations`, `settings`, `users`, `permission-groups`

### ใช้ AI (AiRouter)
```typescript
import { aiRouter } from '../services/ai/AiRouter';

const { result, providerName, modelName } = await aiRouter.callWithFailover(
  'taskName',
  async (adapter) => adapter.analyzeDailyConversations(params)
);
// retry อัตโนมัติถ้า provider ตอบ 429/402/401/5xx
```

AI provider configs เก็บใน MongoDB (`SystemConfig`) — ไม่ใช้ env vars

### เพิ่ม Mongoose Model
- ดู pattern จาก `models/Conversation.ts` (compound indexes) หรือ `models/AdminUser.ts` (unique field)
- ทุก model ที่ใช้บน webhook hot path ต้องมี index บน fields ที่ query บ่อย

### Config แบบ Dynamic (ConfigService)
```typescript
import { configService } from '../services/ConfigService';
const config = await configService.get(); // cached 60s, อ่านจาก MongoDB singleton
```

---

## Cache Services

| Service | ข้อมูล | Refresh เมื่อ | API ที่ trigger |
|---------|--------|--------------|----------------|
| `MasterIdCache` | lineUserId → Employee | เพิ่ม/แก้/ลบ Employee | employeeRoutes → `.initialize()` |
| `OaRegistry` | channelId → LINE OA credentials | แก้ LINE OA settings | restart หรือ `.reload()` |
| `GroupRegistry` | lineGroupId → OA | แก้ group mapping | restart หรือ `.reload()` |
| `ConfigService` | SystemConfig document | อัพเดทอัตโนมัติทุก 60 วินาที | — |

Caches warm up ใน `app.ts` ก่อน listen — ถ้า warmup fail server จะ crash intentionally

**GroupRegistry auto-register** — ถ้า OA อยู่ใน group แล้วแต่ยังไม่มี CustomerGroup record, message แรกจะ trigger auto-registration (fetch ชื่อ group จาก LINE API → upsert DB → cache) อย่า assume ว่า group ต้องถูก pre-create เสมอ

---

## Scheduled Jobs (`src/jobs/`)

**DailyAnalysisJob** (`scheduler.ts` → cron `0 23 * * *`):
1. Query conversations ของวันก่อน
2. เรียก AI categorize issues ทีละ group
3. บันทึก `DailyReport` document
4. Track progress ด้วย `getRunState()` → `{ status, totalGroups, processedGroups }`

เพิ่ม job ใหม่: สร้าง class ใน `src/jobs/` → register ใน `src/jobs/scheduler.ts`

---

## Environment Variables

**Required (server crash ถ้าไม่มี):**
```
MONGODB_URI=       # MongoDB connection string
API_KEY=           # X-API-Key for all API requests
JWT_SECRET=        # JWT signing key
```

**Optional:**
```
PORT=3000
CONVERSATION_GAP_HOURS=4       # ช่องว่าง (ชั่วโมง) ที่ถือว่าเป็น conversation ใหม่
CRON_DAILY_ANALYSIS=0 23 * * * # cron schedule สำหรับ DailyAnalysisJob
EVALUATE_PREVIOUS_DAY=true
```

---

## Key Files (non-obvious)

| File | หน้าที่ |
|------|--------|
| `src/api/middleware/jwtAuth.ts` | PERMISSION_KEYS array — ต้องเพิ่มที่นี่ทุกครั้งที่มี permission ใหม่ |
| `src/api/routes/permissionGroupRoutes.ts` | route สำหรับ manage roles — เพิ่ม route ใหม่ถ้ามี permission ใหม่ |
| `src/services/ConfigService.ts` | MongoDB config singleton + migration logic |
| `src/services/ai/knownProviders.ts` | predefined AI provider configs (base URL, auth type) |
| `src/jobs/prompts/` | AI prompt templates สำหรับ daily analysis |

---

## Conversation Response Status

`monitorRoutes.ts` คำนวณ status ของ conversation แต่ละอันแบบนี้:
- **normal** — มี override flag set หรือ staff ส่งข้อความล่าสุด
- **waiting** — ลูกค้าส่งข้อความล่าสุด และ < 15 นาทีที่แล้ว
- **slow** — ลูกค้าส่งข้อความล่าสุด และ > 15 นาทีที่แล้ว

threshold 15 นาทีนี้ hardcoded ใน route — ถ้าต้องการเปลี่ยนต้องแก้ตรงนั้น

---

## Startup Auto-seeding

- **AdminUser** — ถ้าไม่มี admin user เลยใน DB, server จะสร้าง superadmin (username: `superadmin`, password: `superadmin`) ให้อัตโนมัติ
⚠️ ความปลอดภัย: ต้องเปลี่ยนรหัสผ่าน superadmin ทันทีหลัง login ครั้งแรกใน production
- **IssueCategoryMaster** — 10 หมวดหมู่ปัญหาภาษาไทย ถูก insert ให้อัตโนมัติถ้ายังไม่มี
- **ConfigService** — มี 3 migrations ที่รันอัตโนมัติตอน startup เพื่อ convert format เก่า อย่า edit SystemConfig document ใน MongoDB โดยตรงด้วย format เก่า

---

## Webhook Rawbody Capture

`app.ts` ใช้ `verify` callback ใน `express.json()` เพื่อเก็บ raw body ก่อน parse — ใช้สำหรับ LINE HMAC signature verification อย่า replace หรือ reconfigure JSON parser เพราะจะทำให้ webhook ไม่รับ signature verification

---

## ไฟล์ห้ามแตะ

- `.env` — secrets (ห้าม commit)
- `dist/` — build output
- `node_modules/`
