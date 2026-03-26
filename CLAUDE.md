# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## กฏความปลอดภัย — ห้ามส่งข้อมูลสำคัญขึ้น GitHub

**ห้าม commit หรือ push ไฟล์ที่มีข้อมูลต่อไปนี้โดยเด็ดขาด:**
- `.env`, `.env.local`, `.env.production` และทุก variant ของ env file
- API keys, tokens, passwords, secrets ทุกชนิด
- MongoDB URI ที่มี credentials จริง
- DigitalOcean API key หรือ credentials ของ server
- LINE Channel Secret / Access Token

**ก่อน commit ทุกครั้ง ต้องตรวจสอบว่า:**
- ไฟล์ `.env*` อยู่ใน `.gitignore` แล้ว
- ไม่มี credentials hardcode อยู่ใน source code
- ใช้ placeholder เช่น `your-api-key-here` สำหรับค่าตัวอย่างใน docker-compose หรือ config เท่านั้น

**ถ้าพบว่ามีการเผลอ commit secrets:** แจ้งผู้ใช้ทันทีและแนะนำให้ rotate credentials นั้นก่อนทำอะไรต่อ

## ภาพรวมโปรเจ็ค

ระบบติดตาม KPI พนักงาน Customer Support บน **LINE Official Account (OA)** แบบ real-time
ตรวจจับว่าพนักงานตอบกลับลูกค้าในกลุ่ม LINE เร็วแค่ไหน และประเมินคุณภาพการตอบโดย AI รายวัน

**เป้าหมายหลัก:**
- วัด response time ของพนักงานต่อ message ของลูกค้าในกลุ่ม LINE
- ให้ AI categorize ปัญหาและสรุปแต่ละ conversation รายวัน
- สรุปรายงาน Daily Report รายวันให้ผู้จัดการ
- รองรับหลาย LINE OA และหลายกลุ่มลูกค้า

**โครงสร้าง Monorepo:**
- `line-kpi-system/` — Backend API (Node.js + TypeScript)
- `line-kpi-admin/` — Admin Dashboard (Next.js)
- `plans/` — เอกสารโปรเจ็ค (ภาษาไทย)

---

## Tech Stack

### Backend (`line-kpi-system/`)
| ส่วน | Technology |
|------|-----------|
| Runtime | Node.js |
| ภาษา | TypeScript 5 |
| Framework | Express.js 4 |
| Database | MongoDB + Mongoose 8 |
| LINE Integration | @line/bot-sdk 9 |
| Scheduled Jobs | node-cron 3 |
| HTTP Client | axios |
| AI Provider | 12+ providers via `UniversalAdapter` + `AiRouter` (config stored in MongoDB) |

### Frontend (`line-kpi-admin/`)
| ส่วน | Technology |
|------|-----------|
| Framework | Next.js 14 (App Router) |
| ภาษา | TypeScript 5, React 18 |
| Styling | Tailwind CSS 3 |
| Component Library | shadcn/ui + Base UI React |
| Charts | Recharts 3 |
| Dark Mode | next-themes |

---

## โครงสร้างไฟล์

```
SMLLineCRM/
├── line-kpi-system/src/
│   ├── webhook/            รับ webhook จาก LINE + ตรวจสอบ HMAC signature
│   ├── processors/         pipeline หลัก ประมวลผล message
│   │   ├── MessageProcessor.ts      จำแนกผู้ส่ง (พนักงาน vs ลูกค้า)
│   │   ├── ConversationResolver.ts  หาหรือสร้าง Conversation thread
│   │   ├── ResponsePairer.ts        จับคู่ response กับ customer message
│   │   └── MetricsUpdater.ts        คำนวณ avg/max response time
│   ├── services/           ระบบ cache, AI routing, และ config
│   │   ├── MasterIdCache.ts         cache lineUserId พนักงาน (O(1) lookup)
│   │   ├── OaRegistry.ts            cache credentials ของแต่ละ LINE OA
│   │   ├── GroupRegistry.ts         cache mapping กลุ่ม LINE → OA
│   │   ├── ConfigService.ts         MongoDB config singleton (60s TTL cache)
│   │   └── ai/
│   │       ├── AiAdapter.ts         interface + AiTaskName type
│   │       ├── AiRouter.ts          failover orchestrator (callWithFailover)
│   │       ├── UniversalAdapter.ts  single adapter for all 12+ providers
│   │       └── knownProviders.ts    12 provider definitions (baseUrl, authType)
│   ├── jobs/               scheduled jobs
│   │   ├── ConversationCloseJob.ts  ปิด conversation หมดเวลา (22:00)
│   │   ├── DailyAnalysisJob.ts      categorize conversations + สร้าง DailyReport (23:00)
│   │   └── prompts/
│   │       └── dailyAnalysis.ts     AI prompt สำหรับ batch categorize conversations
│   ├── models/             Mongoose schemas
│   │   ├── LineOa.ts, Employee.ts, CustomerGroup.ts   Master data
│   │   ├── AdminUser.ts, PermissionGroup.ts            Admin auth + permission groups
│   │   ├── IssueCategoryMaster.ts                     หมวดหมู่ปัญหา (user-managed)
│   │   ├── SystemConfig.ts                            config singleton (AI providers)
│   │   ├── Message.ts, Conversation.ts                Transaction data
│   │   ├── DailyReport.ts                             รายงานรายวัน (รวม KPI + issues)
│   │   └── LineProfile.ts                             Cache display name
│   ├── api/                REST API routes + auth middleware
│   │   ├── middleware/
│   │   │   ├── auth.ts        apiKeyAuth — X-API-Key หรือ Authorization: Bearer
│   │   │   └── jwtAuth.ts     jwtAuth, requireSuperAdmin, requirePermission(key)
│   │   └── routes/
│   │       ├── authRoutes.ts           POST /login, /logout, GET /me
│   │       ├── adminUserRoutes.ts      CRUD AdminUser (requires 'users' permission)
│   │       ├── permissionGroupRoutes.ts CRUD PermissionGroup (requires 'permission-groups')
│   │       ├── configRoutes.ts         GET/PUT config, test-ai, list-models
│   │       ├── issueCategoryRoutes.ts  CRUD หมวดหมู่ปัญหา
│   │       ├── dailyReportRoutes.ts    DailyReport CRUD + trigger + job-status
│   │       └── conversationRoutes.ts  ประวัติ conversation + response override
│   └── config/             Environment variables
│
├── line-kpi-admin/src/
│   ├── middleware.ts           Route-level auth guard (JWT verify via jose + permission check)
│   ├── app/
│   │   ├── (auth)/login/       หน้า Login (ไม่มี Sidebar layout)
│   │   ├── (dashboard)/        Route group — ทุกหน้าที่ต้องล็อกอิน (มี Sidebar layout)
│   │   │   ├── layout.tsx      Sidebar layout สำหรับทุกหน้า dashboard
│   │   │   ├── page.tsx        หน้า Dashboard หลัก (DailyReport summary widget)
│   │   │   ├── issue-categories/   จัดการหมวดหมู่ปัญหา (CRUD)
│   │   │   ├── settings/           ตั้งค่า AI providers + jobs
│   │   │   ├── monitor/            real-time monitoring พนักงาน + conversation override
│   │   │   ├── users/              จัดการ AdminUser (ต้องมี 'users' permission)
│   │   │   ├── permission-groups/  จัดการ PermissionGroup (ต้องมี 'permission-groups' permission)
│   │   │   ├── employees/          จัดการพนักงาน
│   │   │   ├── groups/             จัดการกลุ่มลูกค้า
│   │   │   ├── conversations/      ประวัติ conversation
│   │   │   ├── summaries/          สรุปรายวัน
│   │   │   └── oas/                จัดการ LINE OA
│   │   └── api/proxy/[...path]/ API proxy (ซ่อน API key + inject JWT สำหรับ admin routes)
│   ├── components/
│   │   ├── Sidebar.tsx         อ่าน user-info cookie ใน useEffect (ไม่ใช่ตอน render)
│   │   └── ui/                 shadcn UI components
│   ├── lib/api.ts          centralized API client (dailyReportApi, conversationsApi, authApi)
│   ├── lib/knownProviders.ts  provider definitions สำหรับ frontend (mirror ของ backend)
│   └── types/api.ts        TypeScript types
│
└── plans/                  เอกสารโปรเจ็ค (project-overview.md, workflow-diagram.md)
```

---

## Design Decisions ที่ตกลงแล้ว

### การประมวลผล Message (Real-time Pipeline)
```
LINE Webhook → MessageProcessor → ConversationResolver → ResponsePairer → MetricsUpdater → MongoDB
```
- **MessageProcessor**: ใช้ `MasterIdCache` ตรวจว่าผู้ส่งเป็นพนักงานหรือลูกค้า
- **ConversationResolver**: Conversation = thread ของกลุ่มนั้นๆ ที่ยังไม่ถูกปิด
- **ResponsePairer**: หา "customer message ล่าสุดที่ยังไม่มีคนตอบ" แล้วคำนวณ responseGapMs
- **MetricsUpdater**: aggregate avg/max response time ใน Conversation document

### Cache Strategy (โหลดก่อน server รับ traffic)
- `MasterIdCache` — lineUserId ของพนักงานทุกคน → O(1) sender identification
- `OaRegistry` — credentials (secret, token) ของแต่ละ OA → ไม่ต้อง query DB ทุก webhook
- `GroupRegistry` — mapping lineGroupId → OA → ไม่ต้อง query DB ทุก webhook

### Idempotency Guards
- `Message.lineMessageId` — unique index ป้องกัน LINE webhook retry ทำให้ message ซ้ำ

### Conversation Lifecycle
- สร้างใหม่เมื่อลูกค้าส่ง message แรก หรือ message หลังจาก conversation ถูกปิดแล้ว
- ปิดอัตโนมัติเมื่อไม่มี activity เกิน `CONVERSATION_GAP_HOURS` (default: 4 ชั่วโมง)
- `ConversationCloseJob` ทำงานทุกวัน 22:00 เพื่อปิด conversation ที่ค้างอยู่
- `Conversation` มีฟิลด์เพิ่มเติม: `issueCategory`, `issueSummary`, `transcript[]`, `responseStatusOverride`
- Monitor UI สามารถ override `responseStatusOverride` เป็น `'normal'` (resolved) หรือ `null` (automatic) ได้

### Daily Analysis (DailyAnalysisJob — ทุกวัน 23:00)
งาน batch เดียวแทน 3 jobs เดิม (DailyEvaluationJob + IssueAnalysisJob + ConversationCloseJob):
- ดึง conversation ทั้งหมดของวันนั้น พร้อม transcript
- ส่ง batch ให้ AI categorize แต่ละ conversation (task: `issueAnalysis`)
- บันทึก `issueCategory` + `issueSummary` กลับไปใน Conversation document
- สร้าง `DailyReport` document รวม: groupCount, jobCount, totalMessages, employeeBreakdown[], issueCategorySummary[]
- Export `getRunState()` function สำหรับ monitoring in-memory progress

**DailyReport document:**
```typescript
{
  date, groupCount, jobCount, totalMessages,
  customerMessages, employeeMessages,
  employeeBreakdown[],      // per-employee message counts
  issueCategorySummary[],   // { category, count } aggregation
  status,                   // 'pending' | 'complete' | 'failed'
  processedGroups, totalGroups,
  aiProvider, aiModel, generatedAt
}
```

### AI Provider Routing (AiRouter + UniversalAdapter)
AI config เก็บใน MongoDB `SystemConfig` singleton (ไม่ใช่ env vars แล้ว) จัดการผ่านหน้า Settings

**การใช้งาน pattern หลัก:**
```typescript
import { aiRouter } from '../services/ai/AiRouter';

const { result, providerName, modelName } = await aiRouter.callWithFailover(
  'issueAnalysis',              // AiTaskName (ปัจจุบันมีเพียง task นี้)
  async (adapter) => adapter.analyzeDailyConversations(params)
);
```

**Failover logic:** ลอง (provider, model) candidates ตามลำดับ priority จาก `SystemConfig.ai.tasks[taskName].groupId`
- Retryable errors: HTTP 429, 402, 401, 502, 503, 504, และ 400 ที่ body มี "model"/"not found"
- Non-retryable errors: throw ทันที (ไม่ลอง next candidate)

**UniversalAdapter** รองรับ 3 auth types: `bearer`, `x-api-key`, `query-param`
และ handle Anthropic native format แยกจาก OpenAI-compatible standard
- Method หลัก: `analyzeDailyConversations()` รับ conversations batch, คืน `{ conversationId, category, summary }[]`

**Known providers** (12 ตัว): OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, MiniMax, Kimi, OpenRouter, Z.ai, Kilo, SML Router
- `knownProviders.ts` มีทั้งใน backend (`services/ai/`) และ frontend (`lib/`) — content เหมือนกัน

**ConfigService**: 60s in-memory TTL cache, auto-migrates old flat config formats (env-var era, tier-based era)

### AI Daily Analysis Prompt
- Prompt ไฟล์: `jobs/prompts/dailyAnalysis.ts`
- Input: `groupName`, `date`, `conversations[]`, `masterCategories[]` (hints จาก IssueCategoryMaster)
- Output: JSON array `[{ conversationId, category, summary }]`
- ใช้ Thai language, ให้ AI ใช้ master categories ถ้าเหมาะสม หรือสร้างใหม่
- ไม่มี KPI qualityScore, strengths, improvements อีกต่อไป

### Admin Auth System
- **Two-tier auth**: API Key (ทุก route) + JWT (admin management routes)
- **AdminUser model**: `username`, `passwordHash` (bcrypt), `isSuperAdmin`, `isActive`, `groupId`, `additionalPermissions`
- **Default seed**: `superadmin` / `superadmin` สร้างอัตโนมัติถ้ายังไม่มี superadmin ใน DB
- **PermissionKey** (11 keys): `dashboard`, `monitor`, `groups`, `oas`, `employees`, `summaries`, `issue-categories`, `conversations`, `settings`, `users`, `permission-groups`

**Middleware pattern:**
```typescript
// ใช้ requirePermission แทน requireSuperAdmin สำหรับ routes ที่ non-superadmin ควรเข้าได้
import { requirePermission } from '../middleware/jwtAuth';
router.use(requirePermission('users')); // allow superadmin OR user with 'users' permission
```

**Login flow:**
```
POST /api/proxy/auth/login
  → proxy forwards (no API key) → backend bcrypt.compare
  → proxy sets httpOnly cookie `auth-token` (JWT) + readable cookie `user-info` (JSON)
  → browser never sees JWT directly
```

**Frontend middleware** (`middleware.ts`):
- Reads `auth-token` cookie → verify JWT via `jose`
- Superadmin bypasses all checks; others checked against `ROUTE_PERMISSIONS` map
- Requires `JWT_SECRET` env var (must match backend)

**Sidebar cookie pattern** — อ่าน `user-info` cookie ใน `useEffect` เท่านั้น (ไม่อ่านตอน render เพื่อป้องกัน hydration error):
```typescript
const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
useEffect(() => { setUserInfo(getUserInfo()); }, []);
```

**Proxy JWT forwarding** — `admin/` paths: proxy อ่าน `auth-token` cookie แล้วใส่ `Authorization: Bearer` ก่อน forward ไป backend

### Issue Category Master
- `IssueCategoryMaster` — หมวดหมู่ปัญหาที่ user จัดการเองผ่าน admin UI (`/issue-categories`)
- Auto-seeds 10 default Thai categories เมื่อ endpoint ถูกเรียกครั้งแรก
- Soft delete (marks `isActive: false`) ไม่ลบจริง
- AI prompts ดึง active categories มาเป็น hint ก่อน categorize

### Frontend API Proxy
- ทุก request จาก browser ส่งผ่าน `/api/proxy/[...path]` (Next.js Route Handler)
- Route Handler เพิ่ม `X-API-Key` header ก่อนส่งต่อไป backend
- API key ไม่เคยถูกส่งไปยัง browser โดยตรง
- API keys ใน Settings page แสดงเป็น `••••••` เสมอ (masked ทั้ง frontend และ backend response)

---

## API Endpoints หลัก
| Endpoint | คำอธิบาย |
|----------|----------|
| `GET /api/v1/daily-report` | DailyReport summary สำหรับวันที่ระบุ |
| `GET /api/v1/daily-report/jobs` | paginated list conversations พร้อม filter (groupId, category, employeeId) |
| `GET /api/v1/daily-report/filter-options` | dropdown data (groups, categories, employees) สำหรับวันที่ระบุ |
| `GET /api/v1/daily-report/job-status` | in-memory run state ของ DailyAnalysisJob |
| `POST /api/v1/daily-report/trigger` | trigger DailyAnalysisJob สำหรับวันที่ระบุ (query: `date`, `force`) |
| `GET/POST/PUT/DELETE /api/v1/issue-categories` | จัดการ IssueCategoryMaster |
| `GET/PUT /api/v1/config` | SystemConfig (AI providers, jobs toggle) |
| `POST /api/v1/config/test-ai` | ทดสอบ AI provider connection |
| `POST /api/v1/config/list-models` | ดึง model list จาก provider API |
| `GET /api/v1/conversations` | ประวัติ conversation (ใช้ใน monitor + history page) |
| `PUT /api/v1/conversations/:id/response-status` | override responseStatusOverride ใน Monitor |
| `POST /api/v1/auth/login` | login → คืน JWT token (public, ไม่ต้อง API key) |
| `GET/POST/PUT/DELETE /api/v1/admin/users` | จัดการ AdminUser (API key + JWT + `users` permission) |
| `POST /api/v1/admin/users/:id/password` | force reset รหัสผ่าน AdminUser |
| `GET /api/v1/admin/users/:id/effective-permissions` | คำนวณ effective permissions รวม group + additionalPermissions |
| `GET/POST/PUT/DELETE /api/v1/admin/permission-groups` | จัดการ PermissionGroup (API key + JWT + `permission-groups` permission) |
| `GET /api/v1/admin/permission-groups/all-keys` | ดึง list ของ PermissionKey ทั้งหมด |

---

## Environment Variables สำคัญ

### Backend (`line-kpi-system/.env`)
```
MONGODB_URI=            # MongoDB connection string
API_KEY=                # API key สำหรับ REST API (ใช้ใน X-API-Key header)
JWT_SECRET=             # REQUIRED — secret สำหรับ sign JWT token (server crash ถ้าไม่มี)
CONVERSATION_GAP_HOURS= # ชั่วโมงก่อนปิด conversation (default: 4)
```

> **หมายเหตุ:** AI provider config (`AI_PROVIDER`, `OPENROUTER_API_KEY`, `KILO_*` ฯลฯ) เป็น legacy
> ปัจจุบัน config เก็บใน MongoDB ผ่านหน้า Settings ใน admin UI
> `ConfigService` auto-migrate จาก format เก่าให้อัตโนมัติ

### Frontend (`line-kpi-admin/.env.local`)
```
NEXT_PUBLIC_API_URL=    # URL ของ backend API (ใช้ใน lib/api.ts ฝั่ง client)
BACKEND_URL=            # URL ที่ proxy route ใช้ forward ไป backend (default: http://localhost:3000)
API_KEY=                # ใช้ใน proxy route (ไม่ expose ไป client)
JWT_SECRET=             # ต้องตรงกับ backend — ใช้ใน middleware.ts (jose) verify token
```

---

## คำสั่งที่ใช้บ่อย

### Backend
```bash
cd line-kpi-system
npm run dev      # development mode (ts-node-dev, hot reload)
npm run build    # compile TypeScript → dist/
npm start        # run compiled output
npm run lint     # ESLint
```

### Frontend
```bash
cd line-kpi-admin
npm run dev      # development mode (localhost:3000)
npm run build    # production build
npm start        # run production build
npm run lint     # ESLint
```

> **หมายเหตุ:** ไม่มี automated tests (ไม่มี jest/vitest) ในโปรเจ็คนี้
