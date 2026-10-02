# Versions actually used

บันทึกเวอร์ชันที่ติดตั้งและรันจริงบนเครื่องพัฒนา (1 ต.ค. 2026) ตาม PRD §7.1 — ไม่ใช่ค่าที่คาดเดา ค่าทั้งหมด pin แบบ exact ใน `package.json` / `pnpm-lock.yaml` / Dockerfile / Compose

## Runtime และเครื่องมือหลัก

| ส่วน | เวอร์ชัน | ที่ pin | หมายเหตุ |
| --- | --- | --- | --- |
| Node.js | 24.21.0 (LTS) | `.node-version`, `engines`, `node:24.21.0-bookworm-slim` | เครื่องมี Node 26 เป็นค่า default จึงติดตั้ง `node@24` (Homebrew, keg-only) แยก; PRD กำหนด ≥ 24.15 |
| pnpm | 12.8.1 | `packageManager` | ใช้ผ่าน corepack; pnpm 12 ใช้ `allowBuilds` ใน `pnpm-workspace.yaml` แทน `onlyBuiltDependencies` |
| TypeScript | 5.9.3 | ทุก package | dist-tag `latest` คือ 7.0.2 (native compiler) แต่ `@nestjs/swagger` 12 รองรับ `<6.1` และ Nest ต้องใช้ decorator metadata → เลือก 5.9.3 (D-15) |
| PostgreSQL | 17.11 | `postgres:17.11-bookworm` | connection timezone UTC ผ่าน `options=-c TimeZone=UTC` |
| Docker | 27.3.1 / Compose 2.30.3 | — | Docker Desktop บน macOS 26 (arm64) |

## Backend (apps/api)

| Package | Version | หมายเหตุ |
| --- | --- | --- |
| @nestjs/core / common / platform-express / testing | 12.1.2 | ESM (`"type": "module"`, `module: nodenext`) |
| @nestjs/swagger | 12.0.2 | OpenAPI → `packages/api-client/openapi.json` |
| express | 5.2.1 | มากับ platform-express 12 |
| prisma / @prisma/client / @prisma/adapter-pg | 7.10.0 | dist-tag `latest` ชี้ 8.0.0-rc.19 จึง pin 7.10.0 (D-14); generator `prisma-client`, `importFileExtension = "js"` |
| class-validator / class-transformer | 0.15.1 / 0.5.1 | ValidationPipe + custom `@Rule()` |
| zod | 4.6.5 | ตรวจ environment ตอน startup |
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
| react-hook-form / @hookform/resolvers | 7.89.0 / 5.9.1 |
| @radix-ui/react-dialog | 1.1.23 |
| sonner / lucide-react | 2.0.8 / 1.49.0 |
| class-variance-authority / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.7.0 |

ฟอนต์: Archivo (variable, แกน wdth) และ Anuphan (ไทย) ผ่าน `next/font/google` — ดาวน์โหลดตอน build

## ทดสอบและส่งมอบ

| เครื่องมือ | Version |
| --- | --- |
| @playwright/test (Chromium headless shell 153) | 1.63.0 |
| newman | 6.2.2 |
| k6 (Docker) | `grafana/k6:2.3.0` |
| lighthouse | 13.5.0 |
| Jenkins controller | `jenkins/jenkins:2.580.1-lts-jdk21` + plugin 78 ตัว pin เวอร์ชันตรงใน `infra/jenkins/plugins.txt` (ชุดที่ build #5 ผ่าน; `pnpm ci:up` ตรวจว่าติดตั้งตรงทุกตัว — D-44) |
| Jenkins agent | Java 21 (OpenJDK 21.0.11) บนเครื่อง host |

## Smoke test ที่ผ่านจริงตอนเลือกเวอร์ชัน

- Nest 12 ESM boot + Prisma 7 adapter-pg query + PostgreSQL session store: `GET /api/health/ready` → `{"status":"ready"}`
- `prisma migrate diff --from-config-datasource --to-schema` → ไม่มี drift หลัง migration แรก (identity column ไม่ถูกมองเป็น drift)
- Vitest + SWC + Supertest: unit 37 + integration 85 tests ผ่าน
