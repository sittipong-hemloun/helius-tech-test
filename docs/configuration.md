# Configuration

ไฟล์เดียว: `.env` ที่ root ของ repo คัดลอกจาก template ครั้งแรกด้วย `cp .env.example .env` (อยู่ใน `.gitignore`) — ค่าใน template ใช้ได้เฉพาะ PostgreSQL ในเครื่องที่ bind `127.0.0.1` เท่านั้น

API อ่าน `.env` ผ่าน `apps/api/src/env.ts` และ Prisma CLI อ่านผ่าน `apps/api/prisma.config.ts` (ทั้งคู่ใช้ `process.loadEnvFile` ของ Node 24) — ตัวแปรที่ตั้งไว้ใน shell แล้วชนะค่าในไฟล์

| Variable | ค่าใน `.env.example` | ใช้โดย |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `postgres` | รหัสผ่าน superuser `postgres` ของ container (ใช้ตอนสร้าง volume ครั้งแรกเท่านั้น) |
| `POSTGRES_HOST_PORT` | (ไม่ตั้ง = `5432`) | พอร์ตบน host ของ PostgreSQL — เปลี่ยนแล้วต้องแก้พอร์ตใน URL สองตัวด้านล่างด้วย |
| `DATABASE_URL` | `…/employee_console_dev` | API, `db:migrate`, `db:seed`, `db:reset` |
| `TEST_DATABASE_URL` | `…/employee_console_test` | `pnpm test:api` และ `pnpm test:e2e` — **ข้อมูลในฐานนี้ถูกลบทุกครั้งที่ test รัน** ต้องไม่ใช่ฐานเดียวกับ `DATABASE_URL` |

ตัวแปรเสริม (ไม่ต้องอยู่ใน `.env`):

| Variable | Default | ความหมาย |
| --- | --- | --- |
| `PORT` | `3001` | พอร์ตของ NestJS (ฟังที่ `127.0.0.1`) |
| `API_INTERNAL_URL` | `http://127.0.0.1:3001` | ปลายทาง rewrite `/api/*` ของ Next.js — **ถูกฝังตอน `next build`** (dev อ่านตอน start); ถ้าเปลี่ยน `PORT` ให้ตั้งตัวนี้ให้ตรงตอนรัน `pnpm dev` |
| `E2E_SCREENSHOT_DIR` | — | ให้ `pnpm test:e2e` เก็บภาพหน้าจอ 375/1024/1440 px ไว้ใน folder นี้ |

## สิ่งที่ห้ามทำ

- ห้าม commit `.env` หรือใส่ค่าใน `.env` ลงเอกสาร/log
- ห้ามตั้ง `TEST_DATABASE_URL` ให้ชี้ฐานที่มีข้อมูลจริง — integration test จะปฏิเสธถ้าเท่ากับ `DATABASE_URL` แต่ไม่รู้จักฐานอื่น
