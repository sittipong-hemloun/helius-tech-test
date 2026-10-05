# Versions actually used

บันทึกเวอร์ชันที่ติดตั้งและรันจริงบนเครื่องพัฒนา (1 ต.ค. 2026) ตาม PRD §7.1 — ไม่ใช่ค่าที่คาดเดา ค่าทั้งหมด pin แบบ exact ใน `package.json` / `pnpm-lock.yaml` / `compose.yaml`

## Runtime และเครื่องมือหลัก

| ส่วน | เวอร์ชัน | ที่ pin | หมายเหตุ |
| --- | --- | --- | --- |
| Node.js | 24.21.0 (LTS) | `.node-version`, `engines` | เครื่องมี Node 26 เป็นค่า default จึงติดตั้ง `node@24` (Homebrew, keg-only) แยก; PRD กำหนด ≥ 24.15 |
| pnpm | 12.8.1 | `packageManager` | ใช้ผ่าน corepack; pnpm 12 ใช้ `allowBuilds` ใน `pnpm-workspace.yaml` แทน `onlyBuiltDependencies` |
| TypeScript | 5.9.3 | ทุก package | dist-tag `latest` คือ 7.0.2 (native compiler) แต่ `@nestjs/swagger` 12 รองรับ `<6.1` และ Nest ต้องใช้ decorator metadata → เลือก 5.9.3 (D-15) |
| PostgreSQL | 17.11 | `postgres:17.11-bookworm` | รันใน Docker (`compose.yaml`); คอลัมน์ DATE แปลงเป็น `YYYY-MM-DD` ใน service จึงไม่ขึ้นกับ timezone ของ connection |
| Docker | 27.3.1 / Compose 2.30.3 | — | Docker Desktop บน macOS 26 (arm64) |

## Backend (apps/api)

| Package | Version | หมายเหตุ |
| --- | --- | --- |
| @nestjs/core / common / platform-express | 12.1.2 | ESM (`"type": "module"`, `module: nodenext`) |
| @nestjs/swagger | 12.0.2 | Swagger UI ที่ `/api/docs`; `PartialType(..., { skipNullProperties: false })` |
| prisma / @prisma/client / @prisma/adapter-pg | 7.10.0 | dist-tag `latest` ชี้ 8.0.0-rc.19 จึง pin 7.10.0 (D-14); generator `prisma-client`, `importFileExtension = "js"` |
| class-validator / class-transformer | 0.15.1 / 0.5.1 | ValidationPipe + DTO decorators |
| vitest / unplugin-swc / @swc/core | 5.0.3 / 2.0.0 / 1.16.13 | Nest 12 ESM ใช้ Vitest เป็นค่าเริ่มต้น; SWC จำเป็นเพื่อ emit decorator metadata (D-13) |
| supertest | 7.3.0 | integration (HTTP จริงผ่าน Nest app) |
| eslint / typescript-eslint | 9.39.5 / 8.71.0 | ESLint 10 ยังไม่รองรับใน plugin ของ eslint-config-next จึงใช้ 9 ทั้ง repo (D-16) |

## Frontend (apps/web)

| Package | Version |
| --- | --- |
| next / eslint-config-next | 16.3.8 |
| react / react-dom | 19.3.0 |
| tailwindcss / @tailwindcss/postcss | 4.3.3 |
| @tanstack/react-query | 5.104.0 |
| react-hook-form / @hookform/resolvers / zod | 7.89.0 / 5.9.1 / 4.6.5 |
| @radix-ui/react-dialog | 1.1.23 |
| sonner / lucide-react | 2.0.8 / 1.49.0 |
| class-variance-authority / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.7.0 |

ฟอนต์: IBM Plex Sans Thai (ไทย + ละติน) ผ่าน `next/font/google` — ดาวน์โหลดตอน build

## ทดสอบ

| เครื่องมือ | Version |
| --- | --- |
| @playwright/test (Chromium headless shell 153) | 1.63.0 |

## Smoke test ที่ผ่านจริง

- Nest 12 ESM boot + Prisma 7 adapter-pg query บน PostgreSQL 17 (`pnpm dev` → `GET /api/employees` ผ่าน Next rewrite)
- `prisma migrate deploy` ครบ 4 migration (`init` → `perf_indexes` → `remove_login_and_reports` → `simplify`)
- Vitest + SWC + Supertest: unit 39 + integration 21 tests ผ่าน (integration ผ่านทั้ง `TZ=America/Los_Angeles` และ `TZ=Pacific/Kiritimati`); Playwright 15 tests ผ่าน
