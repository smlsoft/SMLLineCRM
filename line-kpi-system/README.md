cd line-kpi-system

# 1. ติดตั้ง dependencies
npm install

# 2. สร้างไฟล์ .env และแก้ไขค่า
cp .env.example .env

# 3. รัน development (hot reload)
npm run dev

# หรือ build + run production
npm run build
npm start