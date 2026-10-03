# Employee Console

เว็บจัดการข้อมูลพนักงานจากไฟล์ Excel ของโจทย์ ([`test-exam-data.xlsx`](apps/api/prisma/seed-data/test-exam-data.xlsx)) สำหรับแบบทดสอบ AI-Augmented Developer — Next.js 16 (UI) + NestJS 12 (API) + PostgreSQL 17, CI/CD ด้วย Jenkins ไป local staging

สเปกตั้งต้นอยู่ใน [docs/prd.md](docs/prd.md) — ระบบ Login/สิทธิ์ (Admin/Viewer) และรายงาน AI (n8n + Gemini) ในสเปกถูกตัดออกโดยตั้งใจเพื่อให้โปรเจกต์เรียบง่าย ทุกคนที่เข้าถึงเว็บได้ใช้งานได้เต็มสิทธิ์

## ทำอะไรได้บ้าง

- **Employees** — ดูรายการ 5 records จาก Excel (ID, Name, Department, Salary `#,##0.00`, Join Date, Status, Last Updated Date), ค้นหาชื่อ (debounce 300 ms), กรอง Department/Status, เรียงลำดับ, แบ่งหน้า, สถานะทั้งหมดอยู่ใน URL
- **CRUD** — เพิ่ม/แก้/ลบ, ID และ Last Updated Date กำหนดโดยระบบ, ป้องกันการเขียนทับด้วย `version` + `If-Match`, ป้องกันสร้างซ้ำด้วย `Idempotency-Key`
- **Delivery** — Docker images (tag = commit SHA), local staging :3100, Jenkinsfile, Postman/Newman, Playwright, k6/Lighthouse

## โครงสร้าง

```text
.
├── apps/
│   ├── api/                      NestJS API
│   │   ├── src/                  feature modules (employees, departments, health, …) + common/config/database
│   │   ├── prisma/               schema, migrations, seed data (Excel ต้นฉบับ + JSON)
│   │   ├── scripts/              seed, demo reset, OpenAPI, perf seed
│   │   └── test/                 Vitest: unit + integration (PostgreSQL จริง)
│   └── web/                      Next.js App Router (UI, /api rewrite → NestJS)
│       └── src/                  app/ (routes) · components/{ui,layout,employees,common} · lib/
├── packages/
│   └── api-client/               OpenAPI document + generated TypeScript types
├── tests/
│   ├── e2e/                      Playwright
│   ├── postman/                  Newman API contract tests
│   └── performance/k6/           load scenarios (ผลลัพธ์ถูก generate ไม่ commit)
├── infra/
│   ├── docker/                   api / web Dockerfiles
│   ├── jenkins/                  controller (JCasC) + host agent
│   └── postgres/                 database init script
├── scripts/                      pnpm task runners: setup, doctor, dev-up, staging, ci, perf
├── docs/                         PRD, architecture, decisions, runbook, …
├── compose.yaml                  dev: postgres (+ jenkins ตาม profile ci)
├── compose.staging.yaml          local staging :3100
├── Jenkinsfile                   CI/CD pipeline
└── package.json                  คำสั่งทั้งหมดของ repo (pnpm workspace)
```

## สิ่งที่ต้องมีในเครื่อง

| เครื่องมือ | เวอร์ชัน | ติดตั้ง |
| --- | --- | --- |
| Node.js | 24 LTS (≥ 24.15, ใช้ 24.21.0) | `brew install node@24` แล้วเพิ่ม `/opt/homebrew/opt/node@24/bin` หน้า PATH |
| pnpm | 12.8.1 | `corepack enable` (อ่านเวอร์ชันจาก `packageManager`) |
| Docker Desktop | Compose v2 | ต้องเปิด daemon ไว้ |
| Java | 17+ | เฉพาะเมื่อรัน Jenkins agent (`brew install openjdk@21`) |

## เริ่มใช้งาน (local dev)

```bash
pnpm install
```

```bash
pnpm run setup
```

`setup` สร้าง `.env` และ `.env.staging` พร้อม secret แบบสุ่ม (ไม่ทับค่าที่มีอยู่, ไม่พิมพ์ค่าออกจอ) — ไม่มีค่าภายนอกที่ต้องเติม (ยกเว้น `JENKINS_GIT_URL` ถ้าต้องการใช้ Git remote)

```bash
pnpm dev:up
```

เปิด PostgreSQL ใน Docker, apply migrations, และครั้งแรกจะ mark ฐานเป็น demo + seed 5 records จาก Excel

```bash
pnpm dev
```

เปิด http://localhost:3000 — web (Next.js hot reload) และ API (NestJS watch) ที่พอร์ต `PORT` ใน `.env` (ค่าเริ่มต้น 3001)

> คำสั่ง `setup` และ `doctor` ต้องมี `run` (`pnpm run setup`, `pnpm run doctor`) เพราะ pnpm มีคำสั่ง built-in ชื่อเดียวกัน
>
> ถ้าพอร์ต 3001 มีโปรแกรมอื่นใช้อยู่ ให้ปิดโปรแกรมนั้น หรือเปลี่ยน `PORT` และ `API_INTERNAL_URL` ใน `.env` ให้ตรงกัน (`pnpm run doctor` จะบอกว่าโปรเซสไหนใช้พอร์ต)

## คำสั่งทั้งหมด

| คำสั่ง | ทำอะไร |
| --- | --- |
| `pnpm run setup` | ตรวจ Node/pnpm/Docker/พอร์ต, สร้าง env ที่ขาด |
| `pnpm run doctor` | ตรวจ process/DB/migration/config โดยไม่แสดง secret |
| `pnpm dev:up` / `pnpm dev` | เปิด DB + migrate (+ seed ครั้งแรก) / รัน web + API แบบ hot reload |
| `pnpm db:migrate` / `pnpm db:seed` | apply migrations / เติมข้อมูล Excel ที่ขาด (ไม่ทับ) |
| `pnpm demo:reset --confirm-reset` | คืนข้อมูลเป็น 5 records (เฉพาะ APP_ENV local/staging และฐานที่ mark ว่า demo) |
| `pnpm test:unit` / `pnpm test:api` | Vitest unit / integration บน PostgreSQL จริง (ฐานทดสอบแยก) |
| `pnpm test:e2e` | Playwright กับ production build + ฐานทดสอบแยก (`E2E_SCREENSHOT_DIR=…` เก็บภาพ 375/1024/1440 px) |
| `pnpm secrets:scan` | ตรวจว่าไม่มีค่า secret จาก `.env*` หรือ pattern credential ใน tracked files |
| `pnpm test:postman` | Newman กับ API ใน APP_ENV=test |
| `pnpm lint` / `pnpm typecheck` / `pnpm build` | ตรวจและ build ทั้ง web/api |
| `pnpm openapi:generate` | สร้าง OpenAPI + client types (CI ตรวจ drift) |
| `pnpm staging:up` / `staging:restart` / `staging:smoke` / `staging:rollback` / `staging:down` | build images ตาม SHA → backup → migrate → deploy :3100 → smoke (ล้มแล้ว rollback อัตโนมัติ) / apply env ใหม่ / ย้อน image ก่อนหน้า |
| `node scripts/staging.mjs reset --confirm-reset` / `restore --file=… --confirm-restore` | คืนข้อมูล 5 records บน staging / restore backup ด้วยสิทธิ์ที่ถูกต้อง |
| `pnpm ci:up` | เปิด Jenkins controller (:8080) และ agent บนเครื่องนี้ |
| `pnpm perf:seed` | สร้าง 10k synthetic records (seed 42) — เฉพาะ `APP_ENV=performance` + ฐานที่ mark performance |
| `pnpm perf:run --label=<name>` | benchmark 10k records (k6 + Lighthouse); `--without-perf-indexes` สำหรับ baseline บน build เดียวกัน; `node scripts/perf-report.mjs <labels…>` สร้างตาราง |
| `pnpm down` | หยุดทุก container ของโปรเจกต์ (ไม่ลบ volume) |

## Environments

| Environment | Web | API | Database |
| --- | --- | --- | --- |
| local dev | http://localhost:3000 | localhost:`PORT` | `employee_console_dev` |
| local staging | http://localhost:3100 | ภายใน Docker เท่านั้น | `employee_console_staging` (container/volume แยก) |
| test | พอร์ตที่ runner กำหนด | ภายใน runner | `employee_console_test_<run>` |
| performance | http://localhost:3200 | :3201 (benchmark) | `employee_console_perf` |

## เอกสาร

- [docs/architecture.md](docs/architecture.md) — สถาปัตยกรรม, flow, ความปลอดภัย
- [docs/configuration.md](docs/configuration.md) — environment variables ทั้งหมด
- [docs/prd.md](docs/prd.md) — สเปกตั้งต้น (REQ/USR/AC ที่โค้ดอ้างถึงเป็น `PRD §…`; ส่วน Login และ AI reports ถูกตัดออก)
- [docs/runbook.md](docs/runbook.md) — เปิด/ปิด, reset, backup/restore, rollback, Jenkins setup
- [docs/demo-script.md](docs/demo-script.md) — แผนนำเสนอ 15 นาทีและการซ้อม Live Coding
- [AGENTS.md](AGENTS.md) — คู่มือสำหรับ AI agent (กฎข้าม repo, ขอบเขต D-46); แต่ละ folder หลักมี `AGENTS.md` ของตัวเอง และ `CLAUDE.md` ที่ import ไฟล์นั้น
- [docs/decisions.md](docs/decisions.md), [docs/versions.md](docs/versions.md), [docs/performance.md](docs/performance.md), [docs/ai-usage.md](docs/ai-usage.md), [docs/design.md](docs/design.md)
