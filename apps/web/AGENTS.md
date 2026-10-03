<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# apps/web — Next.js UI

Next.js 16 App Router + React 19, TanStack Query, react-hook-form + zod, Tailwind 4, Radix Dialog, sonner กฎข้ามทั้ง repo (salary string, วันที่ `YYYY-MM-DD`, `If-Match`/`Idempotency-Key`, ขอบเขต D-46) อยู่ใน [../../AGENTS.md](../../AGENTS.md)

## หลักการ

- **Next.js เป็นแค่ UI + proxy**: ไม่ต่อ DB และไม่มี Server Actions ทำ CRUD ซ้ำ — `next.config.ts` rewrite `/api/*` ไป NestJS ที่ `API_INTERNAL_URL` (**ถูกฝังตอน build**) เบราว์เซอร์จึงคุย origin เดียว
- ข้อมูลทั้งหมดผ่าน `lib/api.ts` (fetch + `ApiError`) → hooks ใน `lib/queries.ts` (TanStack Query) ชนิดข้อมูลมาจาก `@employee-console/api-client` ห้ามนิยามซ้ำ
- **สถานะของหน้า list อยู่ใน URL** (`lib/list-params.ts`: ค้นหา/กรอง/เรียง/หน้า) เพื่อให้ reload/back/forward คืนค่าได้ (PRD §8.3) และ "back to Employees" ใช้ `lastListHref()`
- แก้ไขต้องส่ง `If-Match` ด้วย `version` ของ record; สร้างต้องส่ง `Idempotency-Key` และ**เก็บ key เดิมไว้เมื่อ `ApiError.outcomeUnknown`** (network/5xx) เพื่อให้ retry replay ไม่สร้างซ้ำ
- salary ใช้ `lib/salary.ts`/`lib/format.ts` (string ↔ แสดงผล `#,##0.00`) อย่าผ่าน `number`; วันที่ date-only อย่า `new Date('YYYY-MM-DD')` (D-05) ช่อง Salary ไม่ reformat ตอน focus (D-31)

## โครงสร้าง `src/`

| Path | หน้าที่ |
| --- | --- |
| `app/` | route; `page.tsx` บางๆ ห่อ `*-view.tsx` (client component ที่ทำงานจริง) ไว้ใน folder เดียวกัน; กลุ่ม `(console)` ใช้ `AppShell` |
| `components/ui/` | primitive ทั่วไปที่ไม่รู้จัก domain (`button`, `dialog`, `form-cell`, `select-control`, `skeleton`, `cn`) |
| `components/layout/` | `AppShell`, `PageHeader`, `PageBar` |
| `components/employees/` | ของเฉพาะ employee (table, filters, form, delete dialog, status badge) |
| `components/common/` | ส่วนประกอบใช้ร่วมที่ไม่ใช่ primitive (`Notice`, `Pagination`, `unsaved-changes` = provider + `GuardedLink` กันออกจากฟอร์มที่ยังไม่บันทึก) |
| `lib/` | logic ล้วน ไม่มี UI: api client, query hooks, list params, formatters; `*.test.ts` อยู่ข้างไฟล์ |

ทิศทาง dependency: `app` → `components/{employees,layout,common}` → `components/ui` → `lib` — `ui/` ห้าม import จาก group อื่น, `lib/` ห้าม import component, และ component ไม่ import กลับจาก `app/` (ถ้าสอง route ต้องใช้ร่วม ให้ย้ายไป `lib/` หรือ `components/`) ใช้ alias `@/…` สำหรับ import ข้าม folder

## หน้าตา (UI)

ออกแบบเป็นโปรแกรม ERP/HR แบบแน่น มีเส้นกริดครบ — **ไม่ใช่ dashboard สำเร็จรูป** อ่าน [docs/design.md](../../docs/design.md) ก่อนแตะ UI: token สีอยู่ใน `app/globals.css`, ฟอนต์ IBM Plex Sans Thai ตระกูลเดียว, light theme, UI เป็นอังกฤษ, รองรับ 375–1440 px อย่าเติมของที่ทำให้ดูเป็น template: sidebar พร้อมไอคอน, การ์ดมุมโค้งลอย, badge/pill มีกรอบ, หัวข้อตัวใหญ่, ตัวเลขสรุปตัวโต, gradient/animation ทางเข้า ทุก input ต้องมี `<label>` และสถานะต้องไม่พึ่งสีอย่างเดียว

## Tests

- `pnpm --filter @employee-console/web run test:unit` — Vitest เฉพาะ logic บริสุทธิ์ใน `src/lib/*.test.ts`
- พฤติกรรมของหน้า (กรอง, CRUD, layout 375/1024/1440) ตรวจด้วย Playwright ใน [tests/e2e](../../tests/AGENTS.md) ไม่ใช่ component test — แก้ flow/ข้อความ/โครง DOM แล้วต้องปรับ spec ตามด้วย
