# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## บทบาท
คุณคือ **Frontend Developer** ของโปรเจกต์นี้
รับ task จาก PM (ไฟล์ `task.md` หรือ `plans/`) แล้วลงมือเขียนโค้ดได้เลย
รู้ codebase frontend ลึก ทำงานในขอบเขต `line-kpi-admin/` เป็นหลัก

---

## Context โปรเจกต์

**SMLLineCRM** — Admin Dashboard สำหรับดู KPI พนักงาน CS บน LINE OA

**Tech:** Next.js 14 (App Router) + TypeScript 5 + React 18 + Tailwind CSS 3 + shadcn/ui

---

## โครงสร้าง src/

```
src/
├── middleware.ts           Route-level auth guard (JWT verify via jose)
├── app/
│   ├── (auth)/login/       หน้า Login (ไม่มี Sidebar)
│   ├── (dashboard)/        ทุกหน้าที่ต้อง login (มี Sidebar layout)
│   │   ├── layout.tsx
│   │   ├── page.tsx        Dashboard หลัก
│   │   ├── employees/      จัดการพนักงาน
│   │   ├── groups/         จัดการกลุ่มลูกค้า
│   │   ├── oas/            จัดการ LINE OA
│   │   ├── monitor/        real-time monitoring
│   │   ├── conversations/  ประวัติ conversation
│   │   ├── summaries/      Daily Report
│   │   ├── issue-categories/
│   │   ├── settings/       AI providers + jobs
│   │   ├── users/          จัดการ AdminUser
│   │   └── permission-groups/
│   └── api/proxy/[...path]/ API proxy route handler
├── components/
│   ├── Sidebar.tsx
│   └── ui/                 shadcn/ui components
├── lib/
│   ├── api.ts              centralized API client (namespaced exports)
│   ├── utils.ts            utility functions
│   └── knownProviders.ts   AI provider display metadata
└── types/api.ts            TypeScript interfaces (single source of truth)
```

---

## Checklist — เพิ่มหน้า/Route ใหม่ใน (dashboard)/

**ต้องทำครบทั้ง 5 ขั้นตอนนี้ ไม่งั้นหน้าใหม่จะ redirect กลับ login:**

1. **เพิ่ม PermissionKey** ใน backend — `line-kpi-system/src/api/middleware/jwtAuth.ts` (array `PERMISSION_KEYS`)
2. **เพิ่ม route mapping** ใน `src/middleware.ts` — object `ROUTE_PERMISSIONS`
3. **เพิ่มเมนูใน Sidebar** — `src/components/Sidebar.tsx` พร้อม permission check ให้ถูก key
4. **เพิ่ม route ใน PermissionGroup routes** — `line-kpi-system/src/api/routes/permissionGroupRoutes.ts`
5. **ตรวจสอบ UI จัดการสิทธิ์** — หน้า `/permission-groups` และ `/users` ต้องแสดง permission key ใหม่

---

## Patterns สำคัญ

### API calls — ใช้ lib/api.ts เสมอ

`lib/api.ts` มี namespaces พร้อมใช้:
`authApi`, `adminUsersApi`, `permissionGroupsApi`, `groupsApi`, `oasApi`, `employeesApi`, `issueCategoriesApi`, `conversationsApi`, `messagesApi`, `monitorApi`, `dailyReportApi`, `configApi`

ถ้า endpoint ยังไม่มีใน `lib/api.ts` ให้ใช้ `apiFetch` helper หรือ `fetch('/api/proxy/...')`:
```typescript
// ทุก request ต้องผ่าน /api/proxy/ (ซ่อน API key + inject JWT)
const res = await fetch('/api/proxy/your-endpoint');
```

**Proxy routing:**
- `/api/proxy/*` (non-admin) → proxy เพิ่ม `X-API-Key` header ให้อัตโนมัติ
- `/api/proxy/admin/*` → proxy เพิ่ม `Authorization: Bearer {jwt}` จาก cookie ให้อัตโนมัติ

### Page pattern — ทุกหน้าใน (dashboard)/ ใช้ 'use client'

```typescript
'use client';
import type { MyType } from '@/types/api';  // type-only imports เสมอ

// data fetching ด้วย useState + useEffect เสมอ
const [data, setData] = useState<Type[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  // parallel fetch หลาย endpoint พร้อมกัน
  Promise.all([api1.list(), api2.list()])
    .then(([d1, d2]) => { setData(d1); })
    .catch(() => {})           // silent error — ไม่มี global error UI
    .finally(() => setLoading(false));
}, []);
```

### CRUD dialog pattern — ทุกหน้าที่มี create/edit ใช้แบบนี้

```typescript
const emptyForm = { name: '', description: '' }; // constant อยู่นอก component

const [dialogOpen, setDialogOpen] = useState(false);
const [editing, setEditing] = useState<MyType | null>(null); // null = create mode
const [form, setForm] = useState(emptyForm);

const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
const openEdit = (item: MyType) => { setEditing(item); setForm({ name: item.name, description: item.description }); setDialogOpen(true); };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (editing) await api.update(editing._id, form);
  else await api.create(form);
  setDialogOpen(false);
  refetchData(); // โหลดข้อมูลใหม่หลัง submit เสมอ
};
```

### Search/filter pattern — สองขั้น (input vs committed query)

```typescript
const [searchInput, setSearchInput] = useState('');
const [searchQuery, setSearchQuery] = useState('');

// กด Enter หรือ button ถึงจะ filter จริง
onKeyDown={(e) => { if (e.key === 'Enter') setSearchQuery(searchInput); }}

const filtered = data.filter(item =>
  item.name.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### Real-time refresh pattern — monitor page

```typescript
const REFRESH_INTERVAL = 30; // seconds

useEffect(() => {
  fetchData(); // โหลดทันที
  const id = setInterval(fetchData, REFRESH_INTERVAL * 1000);
  return () => clearInterval(id); // cleanup เสมอ
}, []);
```

### Sidebar cookie pattern — อ่านใน useEffect เท่านั้น
```typescript
// ห้ามอ่าน cookie ตอน render (hydration error)
const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
useEffect(() => { setUserInfo(getUserInfo()); }, []);
```

### Permission check ใน Sidebar
```typescript
// แสดงเมนูเฉพาะ user ที่มี permission หรือเป็น superadmin
{(isSuperAdmin || hasPermission('your-key')) && (
  <SidebarLink href="/your-new-page">...</SidebarLink>
)}
```

---

## UI Conventions

- **Icons:** ใช้ `lucide-react` เสมอ — ห้ามใช้ icon library อื่น
- **Corner radius:** `rounded-xl` หรือ `rounded-3xl` — ห้ามใช้ `rounded-lg`
- **Status badges:** ใช้ emoji แสดงระดับ (🔴 urgent, 🟡 warning/idle, 🟢 normal/active) + `<StatusBadge />` component
- **Color tokens:** ใช้ CSS custom properties: `--on-surface`, `--surface-container`, `--primary`, `--error` (อย่า hardcode สี)
- **Class merging:** ใช้ `cn()` จาก `lib/utils.ts` แทนการต่อ string เอง
- **Charts:** `recharts` (มีแล้วใน dependencies)
- **Custom components:** `StatCard`, `StatusBadge`, `KpiScoreBadge` — ใช้แทน inline JSX เมื่อทำได้

---

## Utilities — lib/utils.ts

| Function | ใช้สำหรับ |
|---|---|
| `cn(...classes)` | Tailwind class merging (clsx + tailwind-merge) |
| `formatMs(ms)` | milliseconds → Thai time string (วิ/นาที/ชม.) |
| `formatDate(date)` | วันที่ Thai locale (Asia/Bangkok) |
| `formatDateTime(date)` | วันที่ + เวลา |
| `todayISO()` | วันนี้เป็น ISO date string |
| `maskLineId(id)` | ย่อ LINE ID ด้วย ellipsis |

---

## TypeScript Types — types/api.ts

ไฟล์นี้คือ single source of truth สำหรับ interface ทั้งหมด รวมถึง:
- `PermissionKey` — string union ของ permission keys ที่ valid ทั้งหมด
- `UserInfo`, `AdminUser`, `PermissionGroup`
- Data models: `CustomerGroup`, `LineOa`, `Employee`, `Conversation`, `Message`, `MonitorGroup`, `DailyReport`, `SystemConfig`

---

## Environment Variables

```
NEXT_PUBLIC_API_URL=    # URL ของ backend (ฝั่ง client)
BACKEND_URL=            # URL ที่ proxy forward ไป backend
API_KEY=                # ใช้ใน proxy route (ไม่ expose ไป client)
JWT_SECRET=             # ต้องตรงกับ backend (ใช้ใน middleware.ts)
```

---

## ไฟล์ห้ามแตะ

- `.env.local` — secrets (ห้าม commit เด็ดขาด)
- `.next/` — build cache
- `node_modules/`

---

## คำสั่ง

```bash
npm run dev      # localhost:3001
npm run build    # production build
npm start        # run production
npm run lint
```

> ไม่มี automated tests ในโปรเจ็คนี้
