# apps/api — NestJS API

Modular monolith: Controller → Service → Prisma (PostgreSQL) กฎข้ามทั้ง repo (salary string, วันที่ `YYYY-MM-DD`, `If-Match`/`Idempotency-Key`, ขอบเขต D-46) อยู่ใน [../../AGENTS.md](../../AGENTS.md) request lifecycle และ data model อยู่ใน [docs/architecture.md](../../docs/architecture.md) — Prisma/migrations ดู [prisma/AGENTS.md](prisma/AGENTS.md)

## โครงสร้าง `src/`

| Path | หน้าที่ |
| --- | --- |
| `main.ts`, `bootstrap.ts` | entrypoint; `createApp()` ประกอบ middleware/pipe/filter/Swagger — ใช้ร่วมกับ test harness และสคริปต์ OpenAPI |
| `app.module.ts`, `core.module.ts` | root module (ลงทะเบียน feature module ที่นี่); `CoreModule` = global config/clock/logger |
| `employees/` | feature หลัก: controller, service, DTO, `employee-rules.ts` (กฎฟิลด์), `employee-query.ts` (กฎ list/sort) |
| `departments/`, `health/` | feature เล็ก (list แผนก, `live`/`ready`) |
| `idempotency/`, `rate-limit/` | cross-cutting module (ตัวหลังเป็น global `APP_GUARD`) |
| `common/` | envelope, error (`ApiException`/`Errors`), exception filter, request ID, JSON logger, `Clock`, `dates`, OpenAPI helpers |
| `config/` | โหลดและตรวจ env ด้วย zod (`app-config.ts`) |
| `database/` | `PrismaService` (pg adapter), แปลง DB error |
| `validation/` | `@Rule()` decorator + validation pipe |
| `seed/seed-original.ts` | seed/reset ข้อมูล Excel — ใช้ร่วมโดย `scripts/` และ test harness |
| `generated/` | Prisma client — **generate ตอน build/typecheck/dev, ไม่อยู่ใน git, ห้ามแก้** |

feature ใหม่ = folder ของตัวเองที่มี `<name>.module.ts` + controller + service แล้วเพิ่มใน `AppModule` (ไฟล์ `*.module.ts` แยกจาก controller เสมอ)

## ข้อตกลงที่ต้องรักษา

- **ESM + `nodenext`**: relative import ต้องลงท้าย `.js` (`'../common/clock.js'`) แม้ไฟล์เป็น `.ts`
- **Decorator metadata**: Nest DI พึ่ง `emitDecoratorMetadata` — test ใช้ Vitest + SWC (`unplugin-swc`) ห้ามเปลี่ยนไปใช้ esbuild/tsx กับ test เพราะ DI จะพังเงียบ ๆ (D-13)
- **กฎฟิลด์เป็น pure function** (`validation/rule.ts` → `employee-rules.ts`) ใช้ซ้ำใน DTO, service, seed, unit test (D-19) — เพิ่มกฎใหม่ที่นั่น อย่าเขียนตรวจซ้ำใน DTO
- **Employee read/write ใช้ `$queryRaw` + `Prisma.sql`** พร้อม cast `::text`/`::date`, sort whitelist, LIKE escape (D-20) — อย่าเปลี่ยนเป็น Prisma `findMany` ที่คืน `Date` เพราะวันเลื่อนข้ามโซนเวลา
- **Response ทุกตัวผ่าน `respond()`** (`{ data, meta }`) และ error ผ่าน `Errors.*` ที่มี `code` คงที่ → `{ error: { code, message, requestId, details? } }` ห้ามโยน `HttpException` ดิบหรือส่งข้อความ SQL/stack ออกไป
- error code ใหม่/endpoint ใหม่ ต้องบันทึกใน OpenAPI ผ่าน `common/openapi.ts` (`@ApiEnvelope`, `@ApiErrors`) แล้วรัน `pnpm openapi:generate`
- **env อ่านผ่าน `config/app-config.ts` เท่านั้น** (ห้าม `process.env` กระจาย) — เพิ่มตัวแปรต้องแก้ `.env.example` และ [docs/configuration.md](../../docs/configuration.md)
- policy rate limit เป็นต่อ IP; endpoint health ใช้ `@RateLimit('none')`
- ความลับ/ค่า salary/body ห้ามเข้า log (`JsonLogger` มี redact — อย่าข้าม)

## Tests (`test/`)

| Suite | คำสั่ง | หมายเหตุ |
| --- | --- | --- |
| `test/unit` | `pnpm test:unit` | ไม่ใช้ DB |
| `test/integration` | `pnpm test:api` | **PostgreSQL จริง**: `test/support/global-setup.ts` สร้างฐาน `employee_console_test_<run>` ชั่วคราว (role `TEST_DB_*`) และ `assertTestDatabase` กันไม่ให้รันกับฐาน demo/staging; ไฟล์รันทีละไฟล์ |

`test/support/harness.ts` → `startApp()` เปิดแอปจริง + `FakeClock` (ค่าเริ่มต้น 2026-10-01 10:00 Bangkok), `resetData()` คืนข้อมูลเป็น 5 records Excel ถ้าเพิ่ม module/provider ใหม่ ให้ตรวจว่า harness ยังประกอบแอปผ่าน `createApp` ได้โดยไม่ต้อง override

## Scripts (`scripts/`, รันด้วย `tsx`)

`seed`, `demo-reset`, `test-reset`, `mark-database`, `generate-openapi` — สคริปต์ที่ลบ/เขียนทับข้อมูลตรวจเครื่องหมาย `app_meta.database_purpose` (demo/test) ก่อนทำงาน อย่าข้ามการตรวจนี้ `build` ใน Docker คอมไพล์ `scripts/` ไป `dist-scripts/` ด้วย (`tsconfig.scripts.json`) เพื่อให้ staging รัน seed ได้
