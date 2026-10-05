# Employee Console — คู่มือสำหรับ AI agent

pnpm monorepo: **Next.js 16** (UI) + **NestJS 12** (API) + **PostgreSQL 17** (Prisma 7) สำหรับจัดการข้อมูลพนักงานจาก Excel ของโจทย์ (List + Search/Filter + CRUD) ภาพรวมและคำสั่งทั้งหมดอยู่ใน [README.md](README.md) — ไฟล์นี้บอกเฉพาะสิ่งที่อ่านจากโค้ดไม่ออก

แต่ละ folder หลักมี `AGENTS.md` ของตัวเอง (และ `CLAUDE.md` ที่ import ไฟล์นั้น) — อ่านไฟล์ของ folder ที่จะแก้ก่อนลงมือ

## แผนที่ repo

| Path | คืออะไร | คู่มือ |
| --- | --- | --- |
| `apps/api` | NestJS API + Prisma schema/migrations/seed + tests ของ API | [apps/api/AGENTS.md](apps/api/AGENTS.md), [prisma](apps/api/prisma/AGENTS.md) |
| `apps/web` | Next.js App Router (ไม่มี DB, ไม่มี Server Actions) | [apps/web/AGENTS.md](apps/web/AGENTS.md) |
| `tests/e2e` | Playwright + runner `run.mjs` | [tests/AGENTS.md](tests/AGENTS.md) |
| `docs/` | architecture, decisions (D-xx), runbook, PRD, คู่มือเรียนรู้ | ดูหัวข้อ "เอกสาร" ด้านล่าง |
| `compose.yaml` | PostgreSQL สำหรับ dev และ test (service เดียว) | — |

## ขอบเขต — เรียบง่ายตรงโจทย์ (D-46, D-52, D-56)

ตัดออกโดยตั้งใจ: Login/สิทธิ์, AI reports (n8n + Gemini), performance test, Jenkins/CI, local staging, Docker images, Postman, Idempotency-Key, rate limit, envelope `{data, meta}`/request ID, health endpoint, generated API client (`packages/api-client`) และสคริปต์ setup/doctor ส่วนที่พูดถึงเรื่องเหล่านี้ใน `docs/prd.md` และ decision log เป็นประวัติ ไม่ใช่งานที่ต้องทำ — **อย่านำกลับมา** เว้นแต่ผู้ใช้สั่งโดยตรง และอย่าเพิ่ม layer/abstraction ที่ฟีเจอร์ยังไม่ต้องใช้

## กฎที่ข้ามทั้ง repo

- **Salary** เป็น `numeric(12,2)` และเดินทางเป็น **string** ทุกชั้น (DB → JSON → form) ห้ามแปลงเป็น `number`/float
- **วันที่แบบ date-only** (`joinDate`, `lastUpdatedDate`) เป็นสตริง `YYYY-MM-DD` ตลอดทาง ห้ามผ่าน `Date`/timezone ของ browser (D-05) — ฝั่ง API แปลงกับ Prisma ที่จุดเดียวใน `employees.service.ts`; "วันนี้" ของระบบคือเขต `Asia/Bangkok`
- **Concurrency**: แก้ไข/ลบต้องส่ง `If-Match: "<version>"` (ขาด → 428, ไม่ตรง → 409)
- **สัญญา API ↔ เว็บ**: ชนิดข้อมูลฝั่งเว็บเขียนเองใน `apps/web/src/lib/api.ts` — แก้ response/DTO ของ API แล้วต้องแก้ไฟล์นั้นให้ตรง
- **Secret**: `.env` ไม่อยู่ใน git สร้างด้วย `cp .env.example .env` (ค่าใน example ใช้ได้เฉพาะเครื่อง local) อย่าพิมพ์ค่าใน `.env` ออกจอ/log/เอกสาร
- **ภาษา**: UI เป็นอังกฤษ, เอกสารและคำอธิบายในโปรเจกต์เป็นไทย, ชื่อโค้ด/commit เป็นอังกฤษ

## คำสั่งที่พลาดบ่อย

- `pnpm db:reset` ลบพนักงานทั้งหมดในฐานที่ `DATABASE_URL` ชี้แล้ว seed 5 records ใหม่ — ใช้กับฐาน dev/test เท่านั้น
- `pnpm test:api` และ `test:e2e` ต้องมี Postgres รันอยู่ (`pnpm dev:up`) และใช้ `TEST_DATABASE_URL` (ฐาน `employee_console_test`) เท่านั้น ไม่แตะฐาน dev
- รันทุกคำสั่งจาก root; filter รายแพ็กเกจด้วย `pnpm --filter @employee-console/<api|web|e2e> run <script>`
- Node 24 (`.node-version`), pnpm ตาม `packageManager` ใน `package.json`

## ก่อนบอกว่างานเสร็จ

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build
```

แก้ API → รัน `pnpm test:api` ด้วย; แก้ UI/flow → รัน `pnpm test:e2e` ถ้ารันไม่ได้ให้บอกว่าข้ามเพราะอะไร อย่า commit/push เองถ้าผู้ใช้ไม่ได้สั่ง

## เอกสาร (`docs/`)

| ไฟล์ | ใช้เมื่อ |
| --- | --- |
| `learn/` | อธิบายระบบให้คนที่ไม่คุ้น NestJS/Prisma/Docker ด้วยภาษาง่ายและแผนภาพ (สรุปจากโค้ด ไม่ใช่ฉบับอ้างอิง) |
| `architecture.md` | service boundary, request lifecycle, data model |
| `decisions.md` | บันทึก D-xx พร้อมเหตุผล — **เพิ่มแถวใหม่ทุกครั้งที่ตัดสินใจเรื่องที่ไม่ชัดจากโค้ด** (ห้ามแก้ของเดิม ให้ระบุว่าแทนที่ข้อไหน) |
| `configuration.md` | env variables ทั้งหมด — เพิ่ม env ใหม่ต้องแก้ที่นี่และ `.env.example` |
| `runbook.md` | เปิด/ปิด, reset ข้อมูล, ปัญหาที่พบบ่อย |
| `design.md` | กติกา UI แบบ ERP หนาแน่น (ดู [apps/web/AGENTS.md](apps/web/AGENTS.md)) |
| `prd.md` | สเปกตั้งต้น; โค้ดอ้างเป็น `PRD §…`, `REQ/USR/AC-xx`; ส่วนที่ตัดออกเหลือหัวข้อพร้อมป้าย D-46/D-52/D-56 — ห้ามลบหัวข้อหรือเปลี่ยนเลขเพราะโค้ดและ migration อ้างอยู่ |
| `versions.md`, `ai-usage.md`, `demo-script.md` | เหตุผลที่ pin เวอร์ชัน / การใช้ AI / แผนนำเสนอ |
