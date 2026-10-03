# Employee Console — คู่มือสำหรับ AI agent

pnpm monorepo: **Next.js 16** (UI) + **NestJS 12** (API) + **PostgreSQL 17** (Prisma 7) สำหรับจัดการข้อมูลพนักงาน (List + Search/Filter + CRUD) ภาพรวมและคำสั่งทั้งหมดอยู่ใน [README.md](README.md) — ไฟล์นี้บอกเฉพาะสิ่งที่อ่านจากโค้ดไม่ออก

แต่ละ folder หลักมี `AGENTS.md` ของตัวเอง (และ `CLAUDE.md` ที่ import ไฟล์นั้น) — อ่านไฟล์ของ folder ที่จะแก้ก่อนลงมือ

## แผนที่ repo

| Path | คืออะไร | คู่มือ |
| --- | --- | --- |
| `apps/api` | NestJS API + Prisma schema/migrations + tests ของ API | [apps/api/AGENTS.md](apps/api/AGENTS.md), [prisma](apps/api/prisma/AGENTS.md) |
| `apps/web` | Next.js App Router (ไม่มี DB, ไม่มี Server Actions) | [apps/web/AGENTS.md](apps/web/AGENTS.md) |
| `packages/api-client` | OpenAPI + TypeScript types ที่ **generate** จาก API | [packages/api-client/AGENTS.md](packages/api-client/AGENTS.md) |
| `tests/` | Playwright (e2e), Newman (postman), k6 (performance) | [tests/AGENTS.md](tests/AGENTS.md) |
| `infra/` | Dockerfiles, Jenkins controller/agent, postgres init | [infra/AGENTS.md](infra/AGENTS.md) |
| `scripts/` | task runner `.mjs` ที่ `package.json` เรียก | [scripts/AGENTS.md](scripts/AGENTS.md) |
| `docs/` | architecture, decisions (D-xx), runbook, PRD | ดูหัวข้อ "เอกสาร" ด้านล่าง |

`compose.yaml`, `compose.staging.yaml`, `Jenkinsfile`, `pnpm-workspace.yaml` และ Dockerfiles อ้าง path เหล่านี้ตรง ๆ — **อย่าย้าย top-level folder** โดยไม่แก้ไฟล์ทั้งหมดนี้พร้อมกัน

## ขอบเขต (D-46)

ระบบ Login/สิทธิ์ (Admin/Viewer) และ AI reports (n8n + Gemini) **ถูกตัดออกโดยตั้งใจ** ทุกคนที่เข้าเว็บได้ใช้งานเต็มสิทธิ์ ส่วนที่พูดถึงสองเรื่องนี้ใน `docs/prd.md` และใน decision log (D-03, D-09, D-24–D-28 ฯลฯ) เป็นประวัติ ไม่ใช่งานที่ต้องทำ — **อย่านำกลับมา** (route, ตาราง, env, script) เว้นแต่ผู้ใช้สั่งโดยตรง

## กฎที่ข้ามทั้ง repo

- **Salary** เป็น `numeric(12,2)` และเดินทางเป็น **string** ทุกชั้น (DB → JSON → form) ห้ามแปลงเป็น `number`/float
- **วันที่แบบ date-only** (`joinDate`, `lastUpdatedDate`) เป็นสตริง `YYYY-MM-DD` ตลอดทาง ห้ามผ่าน `Date`/timezone ของ browser (D-05) ส่วน timestamp เป็น UTC; "วันนี้" ของระบบคือเขต `Asia/Bangkok`
- **Concurrency**: แก้ไข/ลบต้องส่ง `If-Match: "<version>"` (ขาด → 428, ไม่ตรง → 409); สร้างต้องส่ง `Idempotency-Key` (UUID)
- **สัญญา API → client**: แก้ controller/DTO แล้วต้องรัน `pnpm openapi:generate` และ commit ผลใน `packages/api-client` (Jenkins ตรวจ drift)
- **Secret**: `.env` และ `.env.staging` ไม่อยู่ใน git, สร้างด้วย `pnpm run setup` อย่าพิมพ์ค่า secret ออกจอ/log/เอกสาร, ตรวจด้วย `pnpm secrets:scan`
- **ภาษา**: UI เป็นอังกฤษ, เอกสารและคำอธิบายในโปรเจกต์เป็นไทย, ชื่อโค้ด/commit เป็นอังกฤษ

## คำสั่งที่พลาดบ่อย

- ใช้ `pnpm run setup` และ `pnpm run doctor` (ต้องมี `run` — pnpm มี built-in ชื่อเดียวกัน, D-34)
- `pnpm demo:reset --confirm-reset` ลบข้อมูล: ใช้ได้เฉพาะ `APP_ENV` local/staging และฐานที่ mark ว่า demo — อย่ารันกับฐานอื่น
- `pnpm test:api`, `test:e2e`, `test:postman` ต้องมี Docker/Postgres รันอยู่ (`pnpm dev:up`) และสร้างฐานทดสอบชั่วคราวของตัวเอง ไม่แตะ dev/staging DB
- รันทุกคำสั่งจาก root; filter รายแพ็กเกจด้วย `pnpm --filter @employee-console/<api|web|api-client|e2e> run <script>`
- Node 24 (`.node-version`), pnpm ตาม `packageManager` ใน `package.json`

## ก่อนบอกว่างานเสร็จ

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build
```

แก้ API → รัน `pnpm test:api` และ `pnpm openapi:generate && git diff --exit-code -- packages/api-client` ด้วย; แก้ UI/flow → รัน `pnpm test:e2e` ถ้ารันไม่ได้ให้บอกว่าข้ามเพราะอะไร อย่า commit/push เองถ้าผู้ใช้ไม่ได้สั่ง

## เอกสาร (`docs/`)

| ไฟล์ | ใช้เมื่อ |
| --- | --- |
| `architecture.md` | service boundary, request lifecycle, data model, security |
| `decisions.md` | บันทึก D-xx พร้อมเหตุผล — **เพิ่มแถวใหม่ทุกครั้งที่ตัดสินใจเรื่องที่ไม่ชัดจากโค้ด** (ห้ามแก้ของเดิม ให้ระบุว่าแทนที่ข้อไหน) |
| `configuration.md` | env variables ทั้งหมด — เพิ่ม env ใหม่ต้องแก้ที่นี่และ `.env.example` |
| `runbook.md` | เปิด/ปิด, reset, backup/restore, rollback, Jenkins |
| `design.md` | กติกา UI แบบ ERP หนาแน่น (ดู [apps/web/AGENTS.md](apps/web/AGENTS.md)) |
| `prd.md` | สเปกตั้งต้น; โค้ดอ้างเป็น `PRD §…`, `REQ/USR/AC-xx`; ส่วน Login/AI reports เหลือแค่หัวข้อ (D-46) — ห้ามลบหัวข้อหรือเปลี่ยนเลขเพราะโค้ดและ migration อ้างอยู่ |
| `performance.md`, `versions.md`, `ai-usage.md`, `demo-script.md` | ผล benchmark / เหตุผลที่ pin เวอร์ชัน / การใช้ AI / แผนนำเสนอ |
