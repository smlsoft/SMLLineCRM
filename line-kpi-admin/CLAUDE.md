# CLAUDE.md — Frontend Developer Mode

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
│   ├── api.ts              centralized API client
│   └── knownProviders.ts
└── types/api.ts
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

### API calls — ผ่าน proxy เสมอ
```typescript
// ทุก request ต้องผ่าน /api/proxy/ (ซ่อน API key + inject JWT)
const res = await fetch('/api/proxy/your-endpoint');
// หรือใช้ lib/api.ts ที่มีอยู่แล้ว
```

### Sidebar cookie pattern — อ่านใน useEffect เท่านั้น
```typescript
// ห้ามอ่าน cookie ตอน render (hydration error)
const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
useEffect(() => { setUserInfo(getUserInfo()); }, []);
```

### เพิ่ม route ใน middleware.ts
```typescript
// src/middleware.ts — object ROUTE_PERMISSIONS
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/your-new-page': 'your-permission-key',
  // ...
};
```

### Permission check ใน Sidebar
```typescript
// แสดงเมนูเฉพาะ user ที่มี permission หรือเป็น superadmin
{(isSuperAdmin || hasPermission('your-key')) && (
  <SidebarLink href="/your-new-page">...</SidebarLink>
)}
```

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
