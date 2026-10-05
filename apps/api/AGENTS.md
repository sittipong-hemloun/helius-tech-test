# apps/api — NestJS API

Controller → Service → Prisma (PostgreSQL) แบบ feature folder ตามเอกสาร NestJS กฎข้ามทั้ง repo (salary string, วันที่ `YYYY-MM-DD`, `If-Match`, ขอบเขต D-56) อยู่ใน [../../AGENTS.md](../../AGENTS.md) — Prisma/migrations ดู [prisma/AGENTS.md](prisma/AGENTS.md)

## โครงสร้าง `src/`

| Path | หน้าที่ |
| --- | --- |
| `main.ts` | entrypoint: โหลด `.env` → `createApp()` → listen `127.0.0.1:PORT` (default 3001) |
| `app.ts` | `createApp()`: prefix `/api`, global `ValidationPipe`, Swagger `/api/docs` — ใช้ร่วมกับ integration test |
| `app.module.ts` | root module (ลงทะเบียน feature module ที่นี่) |
| `env.ts` | `loadEnv()` อ่าน `.env` ที่ root ด้วย `process.loadEnvFile` (ค่าที่ตั้งไว้แล้วชนะ) |
| `prisma/` | `PrismaModule` (global) + `PrismaService` (pg driver adapter), `createPrismaClient()` สำหรับ script/test |
| `employees/` | feature หลัก: module, controller (HTTP + `If-Match`), service (query + กฎ version), DTO (class-validator + Swagger) |
| `seed.ts` | อ่าน Excel (JSON) แล้ว seed/reset — ใช้โดย `scripts/seed.ts` และ test |
| `generated/` | Prisma client — **generate ตอน build/typecheck/dev, ไม่อยู่ใน git, ห้ามแก้** |

feature ใหม่ = folder ของตัวเองที่มี `<name>.module.ts` + controller + service + dto แล้วเพิ่มใน `AppModule`

## ข้อตกลงที่ต้องรักษา

- **ESM + `nodenext`**: relative import ต้องลงท้าย `.js` (`'./employees.service.js'`) แม้ไฟล์เป็น `.ts`
- **Decorator metadata**: Nest DI พึ่ง `emitDecoratorMetadata` — test ใช้ Vitest + SWC (`unplugin-swc`) ห้ามเปลี่ยนไปใช้ esbuild/tsx กับ test เพราะ DI จะพังเงียบ ๆ (D-13)
- **Validation อยู่ใน DTO** (`employee.dto.ts`) ด้วย decorator ของ class-validator; `ValidationPipe` ตั้ง `whitelist + forbidNonWhitelisted` (field แปลก/field ของระบบ → 400) และ `transform` (query เป็นชนิดจริงพร้อมค่า default) — `UpdateEmployeeDto` ใช้ `PartialType(..., { skipNullProperties: false })` ให้ `null` ถูกตรวจด้วย
- **Prisma client กับวันที่/เงิน**: แปลงที่ `toEmployee()` / `fromDateOnly()` ใน service เท่านั้น — Decimal → `toFixed(2)`, DATE → `toISOString().slice(0, 10)`, input → `new Date('YYYY-MM-DDT00:00:00Z')` (D-56 แทน D-20)
- **ค้นหาชื่อ**: Prisma `contains` ไม่ escape `%`/`_` — service escape เอง อย่าลบ
- **If-Match**: update/delete ใช้ `updateMany`/`deleteMany` ที่ `where: { id, version }` แล้วแยก 404/409 จากผล count 0 — อย่าเปลี่ยนเป็นอ่านแล้วค่อยเขียน (มี race)
- Error ใช้ exception ของ NestJS (`NotFoundException`, `ConflictException`, `HttpException(428)`) → body `{ statusCode, message, error }`; อย่าส่งข้อความ SQL/stack ออกไป
- env อ่านจาก `process.env` หลัง `loadEnv()` — เพิ่มตัวแปรต้องแก้ `.env.example` และ [docs/configuration.md](../../docs/configuration.md)

## Tests (`test/`)

| Suite | คำสั่ง | หมายเหตุ |
| --- | --- | --- |
| `test/unit` | `pnpm test:unit` | ไม่ใช้ DB: กฎใน DTO, การแปลงข้อมูล Excel |
| `test/integration` | `pnpm test:api` | **PostgreSQL จริง** บน `TEST_DATABASE_URL`: `setup.ts` รัน `prisma migrate deploy` (สร้างฐานให้ถ้ายังไม่มี และปฏิเสธถ้าชี้ฐานเดียวกับ `DATABASE_URL`), `app.ts` เปิดแอปจริงบนพอร์ตสุ่ม; ไฟล์รันทีละไฟล์ |

`employees.test.ts` ตรึง "ตอนนี้" ด้วย `vi.useFakeTimers({ toFake: ['Date'] })` (2026-10-01 10:00 Bangkok) และ `seed(prisma, { reset: true })` ก่อนทุก test ให้ ID ถัดไปเป็น 106

## Scripts

`scripts/seed.ts` (รันด้วย `tsx`): `pnpm db:seed` ใส่ 5 records เมื่อตารางว่าง (ไม่ทับข้อมูลเดิม), `pnpm db:reset` ลบพนักงานทั้งหมดแล้ว seed ใหม่
