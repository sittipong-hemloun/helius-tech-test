# Runbook

คำสั่งทุกคำสั่งรันจาก root ของ repo ด้วย Node 24 และ pnpm 12 (`corepack enable`)

## 1. ตั้งเครื่องครั้งแรก

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm dev:up
```

`dev:up` = `docker compose up -d --wait` (PostgreSQL) → `pnpm db:migrate` → `pnpm db:seed` (ใส่ 5 records เมื่อตารางว่าง) รันซ้ำได้ทุกครั้ง ไม่ลบข้อมูล

## 2. Dev

```bash
pnpm dev
```

- web http://localhost:3000, API http://localhost:3001, Swagger http://localhost:3000/api/docs
- หยุด: `Ctrl+C` แล้ว `pnpm down` ถ้าต้องการปิด PostgreSQL ด้วย (ข้อมูลอยู่ใน volume `pgdata`)

## 3. Reset ข้อมูล demo

```bash
pnpm db:reset
```

ลบพนักงานทั้งหมดในฐาน `DATABASE_URL` แล้ว seed 5 records จาก Excel ใหม่ใน transaction เดียว (ID ถัดไป = 106)

## 4. Tests

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build
```

```bash
pnpm test:api
```

```bash
pnpm test:e2e
```

`test:api` และ `test:e2e` ใช้ฐาน `TEST_DATABASE_URL` (Prisma สร้างให้ตอน migrate ครั้งแรก) ต้องเปิด PostgreSQL ไว้ก่อน (`pnpm dev:up`) — `test:e2e` build แอปใหม่และใช้พอร์ต 3020/3021

## 5. ปัญหาที่พบบ่อย

| อาการ | ตรวจ / แก้ |
| --- | --- |
| หน้า Employees แสดง error ตอนโหลด | API ไม่รันหรือพอร์ต 3001 ถูกใช้: `lsof -nP -iTCP:3001 -sTCP:LISTEN` แล้วปิดโปรแกรมนั้น หรือรัน API ที่พอร์ตอื่นด้วย `PORT` และตั้ง `API_INTERNAL_URL` ให้ตรง |
| `pnpm dev:up` ค้างหรือ `Can't reach database server` | เปิด Docker Desktop แล้ว `docker compose ps` ดูสถานะ `postgres` |
| `password authentication failed` | volume `pgdata` ถูกสร้างด้วยรหัสผ่านอื่น — ใช้ `POSTGRES_PASSWORD` เดิมใน `.env` หรือเริ่มใหม่ด้วย `docker compose down -v` (**ลบข้อมูลทั้งหมด**) แล้ว `pnpm dev:up` |
| `TEST_DATABASE_URL is missing` | `.env` เก่ายังไม่มีตัวแปรนี้ — คัดลอกบรรทัดจาก `.env.example` |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm approve-builds` |
