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
- ให้ AI วิเคราะห์คุณภาพการตอบ (qualityScore 1-10) พร้อม feedback รายบุคคล
- สรุปรายงาน KPI รายวันให้ผู้จัดการ
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
│   │       ├── AiAdapter.ts         interface + task name types
│   │       ├── AiRouter.ts          failover orchestrator (callWithFailover)
│   │       ├── UniversalAdapter.ts  single adapter for all providers
│   │       └── knownProviders.ts    12 provider definitions (baseUrl, authType)
│   ├── jobs/               scheduled jobs รายวัน
│   │   ├── ConversationCloseJob.ts  ปิด conversation หมดเวลา (22:00)
│   │   ├── DailyEvaluationJob.ts    ประเมิน KPI + สร้างรายงาน (23:00)
│   │   ├── IssueAnalysisJob.ts      วิเคราะห์ปัญหาลูกค้าด้วย AI (23:30)
│   │   └── prompts/                 AI prompt templates
│   ├── models/             Mongoose schemas
│   │   ├── LineOa.ts, Employee.ts, CustomerGroup.ts   Master data
│   │   ├── IssueCategoryMaster.ts                     หมวดหมู่ปัญหา (user-managed)
│   │   ├── SystemConfig.ts                            config singleton (AI providers)
│   │   ├── Message.ts, Conversation.ts                Transaction data
│   │   ├── KpiRecord.ts, DailySummary.ts, IssueReport.ts  Report data
│   │   └── LineProfile.ts                             Cache display name
│   ├── api/                REST API routes + auth middleware
│   │   └── routes/
│   │       ├── configRoutes.ts         GET/PUT config, test-ai, list-models
│   │       └── issueCategoryRoutes.ts  CRUD หมวดหมู่ปัญหา
│   └── config/             Environment variables
│
├── line-kpi-admin/src/
│   ├── app/
│   │   ├── page.tsx                หน้า Dashboard หลัก (มี Top Issues widget)
│   │   ├── kpi/                    รายงาน KPI (มี Employee Trend chart)
│   │   ├── issues/                 วิเคราะห์ปัญหาลูกค้า (IssueReport)
│   │   ├── issue-categories/       จัดการหมวดหมู่ปัญหา (CRUD)
│   │   ├── settings/               ตั้งค่า AI providers + jobs
│   │   ├── monitor/                real-time monitoring พนักงาน
│   │   ├── employees/              จัดการพนักงาน
│   │   ├── groups/                 จัดการกลุ่มลูกค้า
│   │   ├── conversations/          ประวัติ conversation
│   │   ├── summaries/              สรุปรายวัน
│   │   ├── oas/                    จัดการ LINE OA
│   │   └── api/proxy/[...path]/    API proxy (ซ่อน API key)
│   ├── components/ui/      shadcn UI components
│   ├── lib/api.ts          centralized API client
│   ├── lib/knownProviders.ts  provider definitions สำหรับ frontend
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
- `KpiRecord.(employeeId + date)` — unique index ป้องกัน evaluation ซ้ำ

### Conversation Lifecycle
- สร้างใหม่เมื่อลูกค้าส่ง message แรก หรือ message หลังจาก conversation ถูกปิดแล้ว
- ปิดอัตโนมัติเมื่อไม่มี activity เกิน `CONVERSATION_GAP_HOURS` (default: 4 ชั่วโมง)
- `ConversationCloseJob` ทำงานทุกวัน 22:00 เพื่อปิด conversation ที่ค้างอยู่

### AI Provider Routing (AiRouter + UniversalAdapter)
AI config เก็บใน MongoDB `SystemConfig` singleton (ไม่ใช่ env vars แล้ว) จัดการผ่านหน้า Settings

**การใช้งาน pattern หลัก:**
```typescript
import { aiRouter } from '../services/ai/AiRouter';

const { result, providerName, modelName } = await aiRouter.callWithFailover(
  'issueAnalysis',              // AiTaskName
  async (adapter) => adapter.analyzeIssues(params)
);
```

**Task names:** `groupSummary` | `staffKpi` | `issueAnalysis` | `analyzeResolution`

**Failover logic:** ลอง (provider, model) candidates ตามลำดับ priority จาก `SystemConfig.ai.providerGroups`
- Retryable errors: HTTP 429, 402, 401, 502, 503, 504, และ 400 ที่ body มี "model"/"not found"
- Non-retryable errors: throw ทันที (ไม่ลอง next candidate)

**UniversalAdapter** รองรับ 3 auth types: `bearer`, `x-api-key`, `query-param`
และ handle Anthropic native format แยกจาก OpenAI-compatible standard

**Known providers** (12 ตัว): OpenAI, Anthropic, Google Gemini, DeepSeek, Mistral, Groq, MiniMax, Kimi, OpenRouter, Z.ai, Kilo, SML Router

**ConfigService**: 60s in-memory TTL cache, auto-migrates old flat config formats (env-var era, tier-based era)

### AI Evaluation (ทุกวัน 23:00)
- ประเมินผลวันก่อนหน้า (เริ่ม 23:00 คืนวันนั้น)
- สร้าง `DailySummary` ระดับกลุ่ม (sentiment, top issues)
- สร้าง `KpiRecord` ต่อพนักงานต่อกลุ่ม (qualityScore 1-10, strengths, improvements)
- ใช้ `aiRouter.callWithFailover('staffKpi', ...)` และ `aiRouter.callWithFailover('groupSummary', ...)`

### Customer Issue Analysis (IssueAnalysisJob — ทุกวัน 23:30)
- ทำงานหลัง DailyEvaluationJob เสร็จ
- ดึง conversation transcript + IssueReport 7 วันก่อนหน้า ให้ AI categorize ปัญหา
- AI prompt ใช้ `IssueCategoryMaster` ที่ active เป็น category hint
- สร้าง `IssueReport` ต่อกลุ่มต่อวัน ประกอบด้วย:
  - `issueCategories[]` — {category, count, percentage, examples[], trend: up/down/stable/new}
  - `recurringIssues[]` — ปัญหาซ้ำจากสัปดาห์ก่อน
  - `emergingIssues[]` — ปัญหาใหม่ที่เพิ่งปรากฏ
  - `rootCauseInsight` — AI วิเคราะห์สาเหตุ
  - `recommendedActions[]` — AI แนะนำแนวทางแก้ไข

### Issue Category Master
- `IssueCategoryMaster` — หมวดหมู่ปัญหาที่ user จัดการเองผ่าน admin UI
- Auto-seeds 10 default Thai categories เมื่อ endpoint ถูกเรียกครั้งแรก
- Soft delete (marks `isActive: false`) ไม่ลบจริง
- AI prompts ดึง active categories มาเป็น hint ก่อน categorize

### Employee Leaderboard + Trend
- Leaderboard: composite score = qualityScore 50% + firstResponseRate 30% + conversationsHandled 20%
- Trend: weekly average ย้อนหลัง N สัปดาห์ (default 4)
- ทั้งคู่คำนวณจาก KpiRecord ที่มีอยู่แล้ว ไม่มี model ใหม่

### Frontend API Proxy
- ทุก request จาก browser ส่งผ่าน `/api/proxy/[...path]` (Next.js Route Handler)
- Route Handler เพิ่ม `X-API-Key` header ก่อนส่งต่อไป backend
- API key ไม่เคยถูกส่งไปยัง browser โดยตรง
- API keys ใน Settings page แสดงเป็น `••••••` เสมอ (masked ทั้ง frontend และ backend response)

---

## API Endpoints หลัก
| Endpoint | คำอธิบาย |
|----------|----------|
| `GET /api/v1/kpi` | KpiRecord ต่อพนักงานต่อวัน |
| `GET /api/v1/kpi/leaderboard` | rank พนักงาน (composite score) |
| `GET /api/v1/kpi/trend` | weekly trend ต่อพนักงาน |
| `GET/POST /api/v1/summaries` | DailySummary + manual trigger |
| `GET/POST /api/v1/issue-reports` | IssueReport + trend + manual trigger |
| `GET/POST/PUT/DELETE /api/v1/issue-categories` | จัดการ IssueCategoryMaster |
| `GET/PUT /api/v1/config` | SystemConfig (AI providers, jobs toggle) |
| `POST /api/v1/config/test-ai` | ทดสอบ AI provider connection |
| `POST /api/v1/config/list-models` | ดึง model list จาก provider API |

---

## KPI Metrics ที่วัด
| Metric | คำอธิบาย |
|--------|----------|
| `conversationsHandled` | จำนวน conversation ที่พนักงานมีส่วนร่วม |
| `messagesSent` | จำนวน message ที่ส่ง |
| `avgFirstResponseMs` | เวลาเฉลี่ยในการตอบครั้งแรก |
| `avgResponseMs` | เวลาเฉลี่ยในการตอบโดยรวม |
| `firstResponseRate` | % ของการตอบที่ทำได้ภายใน 5 นาที |
| `qualityScore` | คะแนนคุณภาพจาก AI (1-10) |

---

## Environment Variables สำคัญ

### Backend (`line-kpi-system/.env`)
```
MONGODB_URI=            # MongoDB connection string
API_KEY=                # API key สำหรับ REST API (ใช้ใน X-API-Key header)
CONVERSATION_GAP_HOURS= # ชั่วโมงก่อนปิด conversation (default: 4)
```

> **หมายเหตุ:** AI provider config (`AI_PROVIDER`, `OPENROUTER_API_KEY`, `KILO_*` ฯลฯ) เป็น legacy
> ปัจจุบัน config เก็บใน MongoDB ผ่านหน้า Settings ใน admin UI
> `ConfigService` auto-migrate จาก format เก่าให้อัตโนมัติ

### Frontend (`line-kpi-admin/.env.local`)
```
NEXT_PUBLIC_API_URL=    # URL ของ backend API
API_KEY=                # ใช้ใน proxy route (ไม่ expose ไป client)
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
