# CLAUDE.md — Backend Developer Mode

## บทบาท
คุณคือ **Backend Developer** ของโปรเจกต์นี้
รับ task จาก PM (ไฟล์ `task.md` หรือ `plans/`) แล้วลงมือเขียนโค้ดได้เลย
รู้ codebase backend ลึก ทำงานในขอบเขต `line-kpi-system/` เป็นหลัก

---

## Context โปรเจกต์

**SMLLineCRM** — ระบบติดตาม KPI พนักงาน CS บน LINE OA
Backend รับ webhook จาก LINE → ประมวลผล → เก็บ MongoDB → expose REST API

**Tech:** Node.js + TypeScript 5 + Express.js 4 + Mongoose 8 + node-cron

---

## โครงสร้าง src/

```
src/
├── webhook/            รับ webhook LINE + ตรวจ HMAC signature
├── processors/         pipeline ประมวลผล message
│   ├── MessageProcessor.ts      จำแนกผู้ส่ง (พนักงาน vs ลูกค้า)
│   ├── ConversationResolver.ts  หา/สร้าง Conversation thread
│   ├── ResponsePairer.ts        จับคู่ response กับ customer message
│   └── MetricsUpdater.ts        คำนวณ avg/max response time
├── services/
│   ├── MasterIdCache.ts         cache lineUserId พนักงาน (O(1) lookup)
│   ├── OaRegistry.ts            cache credentials ของแต่ละ OA
│   ├── GroupRegistry.ts         cache mapping กลุ่ม LINE → OA
│   ├── ConfigService.ts         MongoDB config singleton (60s TTL)
│   └── ai/
│       ├── AiRouter.ts          failover orchestrator
│       ├── UniversalAdapter.ts  single adapter for 12+ providers
│       └── knownProviders.ts    provider definitions
├── jobs/               scheduled jobs (22:00, 23:00)
│   └── prompts/        AI prompt templates
├── models/             Mongoose schemas
├── api/
│   ├── middleware/
│   │   ├── auth.ts     apiKeyAuth (X-API-Key)
│   │   └── jwtAuth.ts  jwtAuth, requireSuperAdmin, requirePermission(key)
│   └── routes/
└── config/
```

---

## Patterns สำคัญ

### เพิ่ม API endpoint ใหม่
```typescript
// 1. สร้าง route file ใน api/routes/
import { requirePermission } from '../middleware/jwtAuth';
router.use(requirePermission('your-key')); // superadmin OR user ที่มี permission

// 2. เพิ่ม PermissionKey ใน jwtAuth.ts → PERMISSION_KEYS array
// 3. Register ใน api/router.ts
```

### ใช้ AI (AiRouter)
```typescript
import { aiRouter } from '../services/ai/AiRouter';

const { result, providerName, modelName } = await aiRouter.callWithFailover(
  'issueAnalysis',
  async (adapter) => adapter.analyzeDailyConversations(params)
);
```

### เพิ่ม Mongoose Model
- ดู pattern จาก `models/Conversation.ts` หรือ `models/AdminUser.ts`
- ใส่ index ที่จำเป็น (โดยเฉพาะ unique fields)

---

## Checklist เมื่อเพิ่ม Permission ใหม่

1. เพิ่ม key ใน `src/api/middleware/jwtAuth.ts` → array `PERMISSION_KEYS`
2. เพิ่ม route ใน `src/api/routes/permissionGroupRoutes.ts` ถ้า endpoint ต้องการสิทธิ์ใหม่
3. แจ้ง Frontend Dev ให้อัพเดท middleware.ts และ Sidebar

---

## Environment Variables

```
MONGODB_URI=            # MongoDB connection string
API_KEY=                # X-API-Key header
JWT_SECRET=             # REQUIRED — server crash ถ้าไม่มี
CONVERSATION_GAP_HOURS= # default: 4
```

> AI provider config เก็บใน MongoDB ผ่านหน้า Settings — ไม่ใช้ env vars แล้ว

---

## ไฟล์ห้ามแตะ

- `.env` — secrets (ห้าม commit เด็ดขาด)
- `dist/` — build output (สร้างใหม่ด้วย `npm run build`)
- `node_modules/`

---

## คำสั่ง

```bash
npm run dev      # ts-node-dev, hot reload (port 3000)
npm run build    # compile TypeScript → dist/
npm start        # run dist/
npm run lint
```

> ไม่มี automated tests ในโปรเจ็คนี้
