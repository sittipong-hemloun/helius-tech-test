# Employee Console

เว็บจัดการข้อมูลพนักงานจากไฟล์ Excel ของโจทย์ ([`test-exam-data.xlsx`](apps/api/prisma/seed-data/test-exam-data.xlsx)) สำหรับแบบทดสอบ AI-Augmented Developer — Next.js 16 (UI) + NestJS 12 (API) + PostgreSQL 17 (Prisma 7)

สเปกตั้งต้นอยู่ใน [docs/prd.md](docs/prd.md) — โปรเจกต์นี้ทำให้ **เรียบง่ายตรงโจทย์** โดยตั้งใจ: Login/สิทธิ์, รายงาน AI, performance test, Jenkins/staging/Postman และ hardening ระดับ production ถูกตัดออก (D-46, D-52, D-56) ทุกคนที่เข้าถึงเว็บได้ใช้งานได้เต็มสิทธิ์

## ทำอะไรได้บ้าง

- **Employees** — ดูรายการ 5 records จาก Excel (ID, Name, Department, Salary `#,##0.00`, Join Date, Status, Last Updated Date), ค้นหาชื่อ (debounce 300 ms), กรอง Department/Status, เรียงลำดับ, แบ่งหน้า — สถานะทั้งหมดอยู่ใน URL
- **CRUD** — เพิ่ม/แก้/ลบ, ID และ Last Updated Date กำหนดโดยระบบ, กันการแก้ทับกันด้วย `version` + `If-Match` (อีกแท็บบันทึกก่อน → 409 พร้อมปุ่ม Reload latest)
- **API docs** — Swagger UI ที่ http://localhost:3000/api/docs
- **Tests** — unit (Vitest), integration บน PostgreSQL จริง, E2E (Playwright)

## โครงสร้าง

```text
.
├── apps/
│   ├── api/                  NestJS API
│   │   ├── src/
│   │   │   ├── employees/    module · controller · service · dto  (feature เดียวของระบบ)
│   │   │   ├── prisma/       PrismaModule + PrismaService
│   │   │   ├── app.ts        createApp(): /api prefix, ValidationPipe, Swagger
│   │   │   ├── main.ts       entrypoint
│   │   │   └── seed.ts       ข้อมูลตั้งต้นจาก Excel
│   │   ├── prisma/           schema, migrations, seed data (Excel ต้นฉบับ + JSON)
│   │   ├── scripts/seed.ts   pnpm db:seed / db:reset
│   │   └── test/             unit + integration
│   └── web/                  Next.js App Router (UI, /api rewrite → NestJS)
│       └── src/              app/ (routes) · components/ · lib/ (api, hooks, formatters)
├── tests/e2e/                Playwright + run.mjs
├── docs/                     PRD, architecture, decisions, runbook, คู่มือเรียนรู้
├── compose.yaml              PostgreSQL (dev + test)
└── package.json              คำสั่งทั้งหมดของ repo (pnpm workspace)
```

## สิ่งที่ต้องมีในเครื่อง

| เครื่องมือ | เวอร์ชัน | ติดตั้ง |
| --- | --- | --- |
| Node.js | 24 LTS (≥ 24.15, ใช้ 24.21.0) | `brew install node@24` แล้วเพิ่ม `/opt/homebrew/opt/node@24/bin` หน้า PATH |
| pnpm | 12.8.1 | `corepack enable` (อ่านเวอร์ชันจาก `packageManager`) |
| Docker Desktop | Compose v2 | ต้องเปิด daemon ไว้ (ใช้รัน PostgreSQL) |

## เริ่มใช้งาน

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
pnpm dev:up
```

เปิด PostgreSQL ใน Docker, apply migrations และ seed 5 records จาก Excel (ถ้าตารางยังว่าง)

```bash
pnpm dev
```

เปิด http://localhost:3000 — web (Next.js hot reload) และ API (NestJS watch) ที่พอร์ต 3001

## คำสั่งทั้งหมด

| คำสั่ง | ทำอะไร |
| --- | --- |
| `pnpm dev:up` / `pnpm dev` | เปิด DB + migrate + seed / รัน web + API แบบ hot reload |
| `pnpm down` | หยุด PostgreSQL (ข้อมูลใน volume ยังอยู่) |
| `pnpm db:migrate` / `pnpm db:seed` | apply migrations / ใส่ข้อมูล Excel เมื่อตารางว่าง |
| `pnpm db:reset` | ลบพนักงานทั้งหมดแล้วคืนเป็น 5 records (ID ถัดไป = 106) |
| `pnpm test:unit` / `pnpm test:api` | Vitest unit / integration บน PostgreSQL จริง (ฐาน `TEST_DATABASE_URL`) |
| `pnpm test:e2e` | Playwright กับ production build บนฐานทดสอบ (`E2E_SCREENSHOT_DIR=…` เก็บภาพ 375/1024/1440 px) |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | ตรวจและ build ทั้ง web/api |

## Environments

| Environment | Web | API | Database |
| --- | --- | --- | --- |
| dev | http://localhost:3000 | http://localhost:3001 (เบราว์เซอร์เรียกผ่าน `/api` ของ :3000) | `employee_console_dev` |
| test | http://localhost:3020 (E2E) | :3021 (E2E) / พอร์ตสุ่ม (integration) | `employee_console_test` |

## เอกสาร

- [docs/learn/](docs/learn/README.md) — **คู่มือเรียนรู้ฉบับมือใหม่** (NestJS, Prisma, Docker, แนวคิดสำคัญ, การทดสอบ, เตรียมตอบคำถาม) พร้อมแผนภาพ
- [docs/architecture.md](docs/architecture.md) — สถาปัตยกรรม, request flow, data model
- [docs/configuration.md](docs/configuration.md) — environment variables
- [docs/prd.md](docs/prd.md) — สเปกตั้งต้น (REQ/USR/AC ที่โค้ดอ้างถึงเป็น `PRD §…`; ส่วนที่ตัดออกมีป้าย D-46/D-52/D-56)
- [docs/runbook.md](docs/runbook.md) — เปิด/ปิด, reset ข้อมูล, ปัญหาที่พบบ่อย
- [docs/demo-script.md](docs/demo-script.md) — แผนนำเสนอ 15 นาทีและการซ้อม Live Coding
- [AGENTS.md](AGENTS.md) — คู่มือสำหรับ AI agent (กฎข้าม repo, ขอบเขต); แต่ละ folder หลักมี `AGENTS.md` ของตัวเอง และ `CLAUDE.md` ที่ import ไฟล์นั้น
- [docs/decisions.md](docs/decisions.md), [docs/versions.md](docs/versions.md), [docs/ai-usage.md](docs/ai-usage.md), [docs/design.md](docs/design.md)
