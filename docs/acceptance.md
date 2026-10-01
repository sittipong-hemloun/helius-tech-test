# Acceptance status

สถานะตาม PRD §16: **PASS** = มีหลักฐานจากการรันจริง · **FAIL** · **BLOCKED** = ต้องใช้ข้อมูลภายนอกที่ยังไม่มี (ระบุสิ่งที่ขาด) · **NOT RUN** = ยังไม่ได้รัน
Mock/fixture ใช้ได้เฉพาะใน test environment และ **ไม่นับเป็นหลักฐาน** ของ Google/Gemini/AI Studio/Open WebUI จริง

หลักฐานอ้างอิง (รันบนเครื่องพัฒนา, 1 ต.ค. 2026, commit ล่าสุดใน `git log`):

| ชุด | คำสั่ง | ผล |
| --- | --- | --- |
| Unit | `pnpm test:unit` | API 37 + Web 7 + prompt validator 5 = 49 ผ่าน |
| Integration (PostgreSQL จริง) | `pnpm test:api` | 85 ผ่าน (`employees.test.ts` 31, `auth.test.ts` 31, `reports.test.ts` 23) |
| E2E (production build) | `pnpm test:e2e` | ดู `docs/evidence/test-runs.md` |
| Newman | `pnpm test:postman` | 107 requests, 616 assertions, 0 failed |
| Staging | `pnpm staging:up` | image `c0e9d918585d`, smoke 7/7 ✔ (`docs/evidence/staging.md`) |
| n8n live | `pnpm ai:up --activate` + daily run | error path + template path ✔ (`docs/evidence/n8n.md`) |

## Requirements จากโจทย์ (REQ)

| REQ | สถานะ | หลักฐาน |
| --- | --- | --- |
| REQ-01 Web app จัดการข้อมูล Excel | PASS | seed 5 records ตรง Appendix C (AC-01/03), UI ครบ |
| REQ-02 NodeJS/NestJS | PASS | `apps/api` NestJS 12 |
| REQ-03 Data listing ใช้งานง่าย | PASS | `/employees` (E2E seed test, screenshot review 375/1024/1440 px) |
| REQ-04 Search/filter | PASS | AC-21..24 |
| REQ-05 CRUD | PASS | AC-04, 13, 17 + E2E journey |
| REQ-06/07 ใช้ AI coding assistant, clean code, prompt | PASS | `docs/ai-usage.md`, โครงสร้าง module, decision log |
| REQ-08 รันในเครื่องได้ | PASS | `pnpm run setup` → `pnpm dev:up` → `pnpm dev` และ staging :3100 |
| REQ-09 นำเสนอ 15 นาที | NOT RUN | `docs/demo-script.md` — ผู้สมัครต้องซ้อม |
| REQ-10 Live coding พร้อม | PASS (เตรียมแล้ว) | โจทย์ซ้อม 3 ข้อใน `docs/demo-script.md`; ซ้อมจริงยังไม่ได้ทำ |
| REQ-11 Laptop พร้อม | PASS | toolchain pin + `pnpm run doctor` |
| REQ-12 ID auto | PASS | AC-04/05 |
| REQ-13 Name free text | PASS | AC-06 |
| REQ-14 Department dropdown | PASS | AC-07 |
| REQ-15 Salary `#,##0.00` | PASS | AC-08/09, `formatSalary` unit test |
| REQ-16 Join Date calendar | PASS | `<input type="date">`, AC-10/11 |
| REQ-17 Status checkbox | PASS | AC-12 |
| REQ-18 Last Updated auto stamp | PASS | AC-04/13/14 |

## ขอบเขตเพิ่ม (USR)

| USR | สถานะ | หมายเหตุ |
| --- | --- | --- |
| USR-01 Next.js + NestJS | PASS | |
| USR-02 PostgreSQL | PASS | migrations, seed, reset แยกจากการรันปกติ |
| USR-03 Google Login | **BLOCKED (live)** / PASS (mock OIDC) | flow + allowlist + roles ทดสอบกับ mock provider; login จริงต้องใช้ Google client + อีเมลของผู้สมัคร |
| USR-04 Postman | PASS | collection + env templates + Newman |
| USR-05 Jenkins CI/CD | ดูด้านล่าง AC-54/55 | |
| USR-06 Google AI Studio | **BLOCKED** | ต้องใช้บัญชี Google + Gemini access; ขั้นตอน/ตารางใน `prompts/employee-summary-v1/ai-studio.md` |
| USR-07 n8n | PASS (import/activate/execute live) / **BLOCKED** (เส้นทาง Gemini สำเร็จ) | ต้องใช้ Gemini API key จริง |
| USR-08 Open WebUI | **BLOCKED** | container/config พร้อม; ต้องใช้ Gemini key + สร้างบัญชี admin |
| USR-09 Performance | ดู AC-56 | |

## Acceptance criteria

### Core data และ CRUD

| AC | สถานะ | หลักฐาน (test) |
| --- | --- | --- |
| AC-01 | PASS | `employees.test.ts › fresh migrate+seed…`; `seed-mapping.test.ts`; staging seed log "5 employees (4/1), salary 290000.00, next ID 106" |
| AC-02 | PASS | `employees.test.ts › seeding again does not add rows or overwrite edited values` |
| AC-03 | PASS | `employees.test.ts › every source field matches Appendix C`; E2E `seed data: 5 records…` |
| AC-04 | PASS | `creates ID 106…`, `uses the Bangkok day near midnight UTC`, `persists after an application restart` |
| AC-05 | PASS | `rejects system-managed fields and unknown fields without inserting` |
| AC-06 | PASS | unit `nameRule`; `normalizes names and rejects invalid ones` |
| AC-07 | PASS | `rejects unknown departments and labels`; E2E dropdown 4 ค่า + placeholder |
| AC-08 | PASS | `stores exact decimals…` (65000 / 0 / 9999999999.99); `formatSalary` unit |
| AC-09 | PASS | negative / scale 3 / JSON number / exponent / comma → 400 ไม่ปัด |
| AC-10 | PASS | unit `joinDateRule`; `accepts real dates in range only` |
| AC-11 | PASS | E2E `dates do not shift in UTC / Asia/Bangkok / America/Los_Angeles / Pacific/Kiritimati` |
| AC-12 | PASS | `changes values…` (104 false→true), `rejects string booleans on PATCH`; E2E `Bob Brown checkbox…` |
| AC-13 | PASS | `changes values, bumps version and stamps today (Bangkok)` |
| AC-14 | PASS | `an unchanged PATCH after normalization is a no-op`; E2E `saving without changes is a no-op` |
| AC-15 | PASS | `reads, searches and failed validation leave rows untouched` |
| AC-16 | PASS | `requires If-Match (428) and rejects stale versions (409)`, `concurrent PATCHes… exactly one wins`; E2E two tabs |
| AC-17 | PASS | `deletes one row, then 404…; IDs are not reused`; E2E journey |
| AC-18 | PASS | E2E `cancel delete and cancel a dirty edit leave data unchanged` |
| AC-19 | PASS | `replays the same key+payload…`, `two concurrent POSTs with the same key create exactly one row` (5 คำขอพร้อมกัน) |
| AC-20 | PASS | API `a retry after a lost response…`; E2E `lost create response: retry with the same key…` (ผลใน test-runs.md) |

### Listing, UX และสิทธิ์

| AC | สถานะ | หลักฐาน |
| --- | --- | --- |
| AC-21 | PASS | `name search is case-insensitive contains` (john/JOHN) |
| AC-22 | PASS | API + E2E Engineering + In Active → Bob Brown, clear → 5 |
| AC-23 | PASS | `treats %, _ and SQL-looking text as literals` |
| AC-24 | PASS | sort stable + id tiebreak (API), URL/reload/back/forward (E2E) |
| AC-25 | PASS | empty/page เกิน/total=0 (API); auto step-back หลังลบแถวสุดท้าย (โค้ด `employees-view.tsx`) |
| AC-26 | PASS | `Admin sees Salary and CRUD permissions`; E2E |
| AC-27 | PASS | `Viewer responses have no salary key at all…`; E2E ตรวจ network body ไม่มี `"salary"` |
| AC-28 | PASS | `Viewer mutations via the API are 403 and change nothing`; E2E direct API |
| AC-29 | PASS (mock) / **BLOCKED (real Google)** | `denies accounts outside the allowlist` (mock OIDC) |
| AC-30 | PASS | forged state, wrong nonce/issuer/audience, expired token → `login_failed`, ไม่มี session |
| AC-31 | PASS | rotate session id (mock OIDC), logout, idle (expired store), absolute 8h (FakeClock); E2E logout/expired |
| AC-32 | PASS | `cookie-authenticated mutations without/with wrong CSRF or foreign Origin are 403…` |
| AC-33 | PASS | `uses the role from the current configuration, not the one at login` |
| AC-34 | PASS | unit config + `refuses when the database purpose does not match`, `exposes no HTTP route that issues sessions` |
| AC-35 | PASS | E2E mobile 375 px (no overflow, stacked), keyboard/labels/focus/error text; manual screenshot review |

### AI workflow และ failure modes

| AC | สถานะ | หลักฐาน |
| --- | --- | --- |
| AC-36 | PASS | `Admin gets 202 with a QUEUED report…` (<1 s), snapshot คงที่หลังแก้ข้อมูล |
| AC-37 | PASS | `Viewer cannot generate or see integrations but can read reports` |
| AC-38 | PASS | replay / 409 `REPORT_IN_PROGRESS` + `currentReportId`, concurrent first requests |
| AC-39 | PASS | `only one of many concurrent claims gets the job` (6 พร้อมกัน); scope token แยก |
| AC-40 | PASS (mocked provider) / **BLOCKED (live Gemini)** | integration + E2E แสดงผลแบบ text; live ต้องใช้ key |
| AC-41 | PASS | backoff 30 s / 60 s, FAILED หลัง 3 attempts (FakeClock) |
| AC-42 | PASS | non-retryable → FAILED ทันที, ไม่รับข้อความอิสระ; **live**: Gemini key ผิด → `PROVIDER_AUTH_ERROR` (`docs/evidence/n8n.md`) |
| AC-43 | PASS | lease หมด → requeue, callback เก่า 409 `STALE_LEASE` |
| AC-44 | PASS | deadline 10 นาทีโดยไม่มี worker → FAILED, CRUD ใช้ได้ |
| AC-45 | PASS | duplicate complete เดิม 200 / ต่าง 409 |
| AC-46 | PASS (API) / PASS (workflow live สร้างรายงาน) | integration `one report per Bangkok business day`; n8n daily execute → 202 |
| AC-47 | PASS | integration TEMPLATE; **live** n8n template path (`docs/evidence/n8n.md`) |
| AC-48 | PASS | `claim payload is aggregate-only`, E2E ตรวจ payload |
| AC-49 | PASS (automated) / NOT RUN (manual demo) | deadline test + CRUD ระหว่างไม่มี worker; การปิด service ต่อหน้ายังไม่ได้ซ้อม |
| AC-50 | **BLOCKED** | ต้องใช้ Gemini key + บัญชี AI Studio/Open WebUI |

### Delivery, performance และ traceability

| AC | สถานะ | หลักฐาน |
| --- | --- | --- |
| AC-51 | PASS | `pnpm run setup` / `pnpm dev:up` / `pnpm dev` บนเครื่องนี้ (พอร์ต 3001 ถูกโปรแกรมอื่นใช้ → ทดสอบด้วย `PORT` อื่น ตามที่ README อธิบาย) |
| AC-52 | PASS | staging รันโดยไม่มี Jenkins/n8n/Open WebUI (smoke ✔) |
| AC-53 | PASS | Newman 107/616, `pnpm secrets:scan` ไม่พบ secret ใน export |
| AC-54 | ดู `docs/evidence/jenkins/` | |
| AC-55 | ดู `docs/evidence/staging.md` | |
| AC-56 | ดู `docs/performance.md` | |
| AC-57 | PASS | `pnpm secrets:scan` (ค่าใน `.env`/`.env.staging` + pattern), logs redact; `.env*` อยู่ใน `.gitignore` |
| AC-58 | NOT RUN | ผู้สมัครต้องซ้อมตาม `docs/demo-script.md` |
| AC-59 | PASS | README, PRD, migrations, seed, OpenAPI, collections, workflows, prompt, evidence |
| AC-60 | PASS | เอกสารนี้ |

## Release gate (PRD §16.6)

- **Core-ready**: ทุกข้อ AC-01..35 และ 51–52 ผ่านด้วย automated tests **ยกเว้น manual Google Login จริง (AC-29 real)** ที่ BLOCKED → สถานะ **core implementation-ready, external-verification-pending (Google)**
- **Full-scope-ready**: ยังไม่ใช่ — Gemini live (AC-40/50), AI Studio, Open WebUI รอ credentials ของผู้สมัคร

## Known limitations

- Rate limiter อยู่ในหน่วยความจำ (1 API instance ตาม PRD) — ไม่รองรับหลาย instance
- Trigram index (ถ้าเพิ่มหลังวัด) เป็น SQL-only ที่ Prisma schema แสดงไม่ได้ (`prisma migrate diff` จะรายงานเป็นส่วนเกิน)
- Validator ของรายงานตรวจโครงสร้างและตัวเลข แต่ไม่พิสูจน์ความถูกต้องเชิงภาษาทั้งหมด
- Browser `beforeunload` ไม่รับประกันบนมือถือทุกเครื่อง (ตาม PRD)
