# Decision log

D-01 ถึง D-12 มาจาก PRD §20.1 และนำมาใช้ตามนั้น ส่วน D-13 เป็นต้นไปคือรายละเอียดที่ตัดสินใจระหว่าง implement พร้อมเหตุผล ตาม PRD §6.1 ("การเปลี่ยนสเปกภายหลังให้บันทึกเหตุผลใน decision log")

## จาก PRD (ใช้ตามสเปก)

| ID | ค่าที่ใช้ | ที่อยู่ในโค้ด |
| --- | --- | --- |
| D-01 Stack | Next.js 16 + NestJS 12 + PostgreSQL 17, TypeScript, Prisma 7 | `apps/web`, `apps/api` |
| D-02 Storage | PostgreSQL + Docker volume; seed เติมเฉพาะ ID ที่ขาด ไม่ทับข้อมูล | `apps/api/src/seed/seed-original.ts` |
| D-03 Auth | Google OIDC (openid-client 6), PostgreSQL sessions, allowlist, ADMIN/VIEWER | `apps/api/src/auth/*` |
| D-04 Salary | `numeric(12,2)`, JSON เป็น string, Viewer ไม่ได้รับ key `salary` (ไม่ select ใน SQL ด้วย) | `employees.service.ts` |
| D-05 Time | date-only เป็นสตริง `YYYY-MM-DD` ตลอดทาง, timestamp UTC, วันธุรกิจ Asia/Bangkok | `common/dates.ts`, `web/src/lib/format.ts` |
| D-06 Delete | hard delete + confirmation dialog | `DeleteEmployeeDialog` |
| D-07 Concurrency | `version` + `If-Match` (428/409), create ใช้ Idempotency-Key | `employees.service.ts`, `idempotency.service.ts` |
| D-08 UI | UI อังกฤษ, เอกสาร/รายงานไทย, light theme, responsive | `apps/web` |
| D-09 Reports | aggregate-only snapshot, คิวใน PostgreSQL, n8n worker | `apps/api/src/reports/*`, `workflows/n8n` |
| D-10 Delivery | local staging :3100, Jenkins agent บน host, image tag = commit SHA | `compose.staging.yaml`, `scripts/staging.mjs`, `Jenkinsfile` |
| D-11 Performance | 10k synthetic (seed 42), targets §15.2 | `apps/api/scripts/perf-seed.ts`, `tests/performance` |
| D-12 ไม่ทำ | Redis, K8s, RAG, multi-tenant | — |

## ตัดสินใจระหว่าง implement

| ID | การตัดสินใจ | เหตุผล |
| --- | --- | --- |
| D-13 | API tests ใช้ **Vitest + unplugin-swc + Supertest** แทน Jest | Nest 12 แนะนำ Vitest สำหรับโปรเจกต์ ESM; Jest+ESM ต้องใช้ flag ทดลอง SWC จำเป็นเพราะ esbuild ไม่ emit decorator metadata (DI จะพังเงียบ ๆ) |
| D-14 | Prisma pin **7.10.0** | dist-tag `latest` ของ `prisma` ชี้ไป 8.0.0-rc.19 (release candidate) ซึ่งขัดกับ PRD "Prisma ORM 7" |
| D-15 | TypeScript **5.9.3** | `latest` = 7.0.2 (native) ยังไม่ผ่าน peer ของ `@nestjs/swagger` (<6.1) และไม่ได้ยืนยัน decorator metadata |
| D-16 | ESLint **9.39.5** | plugin ใน eslint-config-next 16 (react, jsx-a11y, import) ยังประกาศ peer ถึง ESLint 9 |
| D-17 | Rate limiter เขียนเอง (fixed window ในหน่วยความจำ) แทน `@nestjs/throttler` | ต้องแยก policy ตาม session/IP/token (read 300, write 60, Google start 10/IP, claim 10/token) และปิดได้เฉพาะ performance; PRD อนุญาต in-process limiter เพราะมี API instance เดียว |
| D-18 | เพิ่ม `GET /api/auth/providers` (public) | หน้า Login ต้องบอกได้ว่า Google ยังไม่ตั้งค่าโดยไม่ต้องกดแล้วเจอ 503 ดิบ; คืนเพียง `{google:{configured}}` ไม่มี secret |
| D-19 | Validation ใช้ `@Rule(fn)` decorator ห่อ pure function | กฎเดียวกันใช้ทั้งตรวจ DTO, normalize ใน service, seed และ unit test; error code ละเอียด (เช่น `DECIMAL_SCALE_EXCEEDED`) โดยไม่ซ้ำโค้ด |
| D-20 | Employee read/write ผ่าน `$queryRaw` (Prisma.sql) พร้อม cast `::text` / `::date` | ควบคุม LIKE escape, collation `"C"`, sort whitelist และหลีกเลี่ยงการแปลง `Date` ที่อาจทำให้วันเลื่อน; ยังเป็น parameterized query ทั้งหมด |
| D-21 | Idempotency: insert key ก่อน (`ON CONFLICT DO NOTHING`) ใน transaction เดียวกับการสร้าง | คำขอพร้อมกันที่ใช้ key เดียวกันจะรอ unique index แล้ว replay ผลที่ commit แล้ว — ทดสอบ 5 คำขอพร้อมกันได้ 1 แถว; เก็บเฉพาะผลสำเร็จ (error ไม่ถูก cache) |
| D-22 | เพิ่มคอลัมน์ `reports.result_hash` และตาราง `app_meta` | `result_hash` ใช้ตัดสิน duplicate completion (เดิม=200 no-op, ต่าง=409); `app_meta.database_purpose` คือ "เครื่องหมาย" demo/test/performance ที่ reset/fixture/perf ตรวจก่อนทำงาน |
| D-23 | `If-Match` รับทั้ง `"3"` และ `3` | RFC ใช้แบบมี quote; รับแบบไม่มี quote เพื่อให้เครื่องมือ CLI ใช้ง่าย โดยยังบังคับว่าต้องส่ง (428) |
| D-24 | Session idle timeout ใช้ `rolling` cookie + expiry ของ session store; absolute 8h ตรวจใน guard ด้วย Clock | store เทียบเวลาจริงของ DB จึงทดสอบ idle ด้วย fixture ที่หมดอายุแล้ว และทดสอบ absolute ด้วย FakeClock |
| D-25 | Session fixture สำหรับ test/performance เป็น **CLI** (`pnpm test:session`) ไม่มี HTTP route; config ห้าม `AUTH_FIXTURES_ENABLED` นอก test/performance และตรวจ DB marker | ตาม PRD §11.5; มี test พิสูจน์ว่าไม่มี route และ staging เปิดไม่ได้ |
| D-26 | Error 409 เมื่อ complete ซ้ำด้วยผลต่างจากเดิมใช้ code `REPORT_ALREADY_COMPLETED` | PRD ระบุเพียงว่า "ต่างตอบ 409"; แยก code จาก `STALE_LEASE` ให้ worker รู้สาเหตุ |
| D-27 | Worker ตรวจตัวเลขในข้อความ AI เทียบกับ snapshot ก่อน complete | กันตัวเลขที่โมเดลแต่งขึ้น (ทุกตัวเลขต้องมีใน snapshot และต้องระบุจำนวนรวม) — ถ้าไม่ผ่านถือเป็น `INVALID_MODEL_OUTPUT` (retryable) |
| D-28 | n8n workflow JSON สร้างจาก `workflows/n8n/build.mjs` | prompt/schema/validator มีแหล่งเดียวใน `prompts/employee-summary-v1` ทำให้ workflow กับ prompt ที่ประเมินแล้วไม่หลุดกัน |
| D-29 | Jenkins controller ใน Docker + inbound agent (WebSocket) บน host, repo local mount ที่ path เดียวกัน | ไม่มี Git remote; controller ต้องอ่าน Jenkinsfile และ agent ต้อง checkout จาก `file://` path เดียวกัน |
| D-30 | Dirty working tree ได้ image tag `<sha>-dirty` | image ไม่อ้างว่าเป็น commit ที่ตัวเองไม่ตรง |
| D-31 | ช่อง Salary ไม่ reformat ตอน focus (format เฉพาะตอน blur และรับ comma ระหว่างพิมพ์) | Playwright เจอว่าการเปลี่ยนค่าใน onFocus ทับ selection แล้วข้อความต่อท้าย (`62000.0063000.00`) |
| D-32 | Baseline performance ไม่มี index บน `department_id`/ชื่อ; index เพิ่มใน migration แยกหลังวัด | PRD §15.3 ให้เก็บ baseline ก่อนเพิ่ม index แล้ววัดซ้ำ |
| D-33 | Readiness ตรวจว่า migration ล่าสุดที่มากับ build ถูก apply แล้ว | "readiness ตรวจ DB และ schema version ที่ app ต้องใช้" (PRD §13.4) |
| D-34 | `pnpm run setup` และ `pnpm run doctor` (มี `run`) | pnpm 12 มีคำสั่ง built-in `setup` และ `doctor` ที่ทับชื่อ script — PRD §13.3 เองระบุให้ใช้ `run` กับ setup ด้วยเหตุผลเดียวกัน |
| D-35 | Trust proxy แบบ `private-1hop` | เชื่อเฉพาะ proxy ตัวที่ต่อเข้ามาตรง (Next.js บน loopback/private) และไม่เชื่อ X-Forwarded-For ชั้นถัดไป — กันการปลอม IP เพื่อหลบ limit 10/นาที/IP ของ Google start (audit finding) |
| D-36 | `RATE_LIMIT_ENABLED=false` ได้เฉพาะ `APP_ENV=test` | performance ใช้ `PERF_RATE_LIMIT_OVERRIDE` ตาม PRD; local/staging ปิด limiter ไม่ได้ |
| D-37 | `demo:reset`/`test:reset` เป็น transaction เดียว (`LOCK TABLE` → ลบ → restart identity → seed) | ไม่มีช่วงที่คำขอสร้างพนักงานแทรกได้ และถ้า seed ล้มข้อมูลเดิมยังอยู่ (audit finding) |
| D-38 | Callback ของ Google ที่ไม่มี login ค้างอยู่ จะไม่ทำลาย session ที่ login แล้ว | กันการ logout ข้ามไซต์ด้วยลิงก์ GET (audit finding) |
| D-39 | 403 `FORBIDDEN` ทำให้ UI อ่าน session ใหม่และ reload เมื่อ role เปลี่ยนจริง | PRD §11.2 "refresh session และ UI" โดยไม่ reload วนซ้ำ |
| D-40 | n8n worker ไม่เก็บ execution data (`saveDataErrorExecution: none`, `saveManualExecutions: false`) | execution data จะมี raw response ของ Gemini; PRD §13.4 ให้ปิดการเก็บ raw provider response โดย default — เปิดชั่วคราวใน n8n UI เมื่อต้อง debug |
| D-41 | สถานะ staging (manifest + backups) อยู่ที่ `~/.employee-console/staging` (`STAGING_STATE_DIR`) | local และ Jenkins (workspace คนละที่) ต้องเห็นประวัติ deploy/rollback ชุดเดียวกัน; restore ผ่าน `staging.mjs restore` ให้ object เป็นของ app role |
| D-42 | OpenAPI อธิบาย envelope `{data, meta}`, error envelope, header สัญญา (ETag, Location, Idempotency-Replayed, Retry-After, X-Request-Id) และ 200/202 ของ scheduled | ให้เอกสารตรงกับ runtime จริง (audit finding) |
| D-43 | Role ฐานข้อมูลแยก: app role `NOCREATEDB` และ test role (`employee_console_test`, `CREATEDB`) สำหรับ test/perf | least privilege — role ที่ dev/staging ใช้รันแอปสร้างหรือลบฐานข้อมูลไม่ได้; runner สร้าง/ลบได้เฉพาะฐานทิ้งได้ของตัวเอง `init-databases.sh` idempotent และรันซ้ำทุก `dev:up`/staging deploy เพื่อปรับ volume เดิม (audit finding) |
| D-44 | Jenkins plugins pin ทุกตัว (รวม dependency) ตามชุดที่ build #5 ผ่าน และ install ล้ม = build image ล้ม | PRD §7.1 ห้ามใช้ latest แบบลอย; เดิมใช้ `\|\| true` กลบความล้มเหลว (audit finding) |
| D-45 | Secret/token ของ test/perf สุ่มใหม่ทุกครั้งที่รัน; perf API ฟัง `127.0.0.1` (k6 ใน Docker เข้าทาง `host.docker.internal`) | ไม่มีค่าที่ใช้ซ้ำได้ฝังใน repo และไม่เปิด API ให้ LAN ระหว่าง benchmark; `tests/e2e/.auth/env.json` เก็บเฉพาะตัวแปรของแอป ไม่ใช่ environment ทั้ง shell (audit finding) |
