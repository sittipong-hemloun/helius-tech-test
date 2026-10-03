# บท 9 — แผนที่เอกสาร ฉบับอ่านง่าย

เอกสารในโปรเจกต์เขียนให้ "แม่นยำ" มากกว่า "อ่านง่าย" บทนี้สรุปแต่ละไฟล์เป็นภาษาธรรมดา บอกว่าไฟล์นั้นมีไว้ทำอะไร ควรเปิดตอนไหน และใจความสำคัญคืออะไร

```mermaid
flowchart TD
    R["README.md<br/>เริ่มที่นี่: ติดตั้ง + คำสั่ง"] --> AR["architecture.md<br/>ระบบต่อกันอย่างไร"]
    R --> RB["runbook.md<br/>ทำงานประจำ + แก้ปัญหา"]
    R --> CF["configuration.md<br/>env ทุกตัว"]
    AR --> DC["decisions.md<br/>ทำไมถึงเลือกแบบนี้"]
    DC --> PRD["prd.md<br/>สเปกตั้งต้น 1,600 บรรทัด"]
    R --> DS["demo-script.md<br/>แผนนำเสนอ 15 นาที"]
    DS --> AI["ai-usage.md<br/>ใช้ AI อย่างไร พลาดตรงไหน"]
    DS --> PF["performance.md<br/>ผลวัดความเร็ว"]
    R --> DG["design.md<br/>กติกาหน้าตา UI"]
    R --> VS["versions.md<br/>เวอร์ชันที่ใช้จริง"]
    R --> AG["AGENTS.md<br/>คู่มือสำหรับ AI agent"]
```

## README.md — ประตูหน้าบ้าน

[README.md](../../README.md) บอกว่าโปรเจกต์ทำอะไร ต้องติดตั้งอะไร และมีคำสั่งอะไรบ้าง

- **อ่านเมื่อ**: วันแรกที่เปิดโปรเจกต์ หรือลืมว่าคำสั่งไหนทำอะไร
- **ใจความ**: ต้องมี Node 24, pnpm 12, Docker Desktop (และ Java 17+ ถ้าจะใช้ Jenkins) ขั้นตอนเริ่มคือ `pnpm install` → `pnpm run setup` → `pnpm dev:up` → `pnpm dev` ตาราง "คำสั่งทั้งหมด" คือสารบัญของ `package.json`

## AGENTS.md และ CLAUDE.md — คู่มือสำหรับ AI

[AGENTS.md](../../AGENTS.md) ที่ root และในแต่ละ folder หลัก (`apps/api`, `apps/web`, `packages/api-client`, `tests`, `infra`, `scripts`) เขียนให้ AI coding assistant อ่านก่อนแก้โค้ด ส่วน `CLAUDE.md` แค่ import ไฟล์ `AGENTS.md`

- **อ่านเมื่อ**: อยากรู้ "กฎที่อ่านจากโค้ดไม่ออก" เช่น salary ต้องเป็น string, import ต้องลงท้าย `.js`, ห้ามแก้ migration เก่า
- **ใจความ**: คนก็อ่านได้ดีเหมือนกัน เพราะเป็นรายการกับดักที่สั้นที่สุดของแต่ละส่วน

## architecture.md — ระบบต่อกันอย่างไร

[architecture.md](../architecture.md) มีแผนภาพ service, ตาราง module ของ API, ลำดับขั้นของ request และ data model

- **อ่านเมื่อ**: ต้องอธิบายระบบให้คนอื่นฟัง หรือจะเพิ่ม module ใหม่
- **ใจความ**
  - เบราว์เซอร์คุยกับ Next.js ที่เดียว Next.js ส่ง `/api/*` ต่อให้ NestJS และไม่แตะฐานข้อมูล
  - API แบ่งเป็น module ตามงาน (`employees`, `departments`, `health`, `rate-limit`, `config`, `common`) แต่ละ module มี Controller → Service → Prisma
  - request ผ่าน 6 ขั้น: request ID → security header/ตรวจ JSON → rate limit → validation → service + interceptor → exception filter (ตรงกับภาพในบท 2)
  - ด้านความปลอดภัย: ไม่เปิด CORS, SQL ใช้ parameter ทั้งหมด, log ไม่บันทึก salary หรือ body

## configuration.md — ตัวแปร env ทุกตัว

[configuration.md](../configuration.md) อธิบาย environment variable ทั้งหมดที่ API อ่าน

- **อ่านเมื่อ**: API ไม่ยอม start (`Invalid configuration`) หรือจะเพิ่ม env ใหม่
- **ใจความ**
  - `pnpm run setup` สร้าง `.env` และ `.env.staging` พร้อม secret แบบสุ่มให้เอง ไม่ต้องกรอกอะไร
  - `APP_ENV` (`local`, `staging`, `test`, `performance`) เป็นตัวคุมว่าคำสั่งอันตรายทำได้หรือไม่
  - `API_INTERNAL_URL` ถูกฝังตอน build เว็บ ถ้าเปลี่ยน `PORT` ต้องเปลี่ยนตัวนี้ด้วย
  - ค่าทุกตัวถูกตรวจด้วย zod ตอน start ผิดแล้วหยุดทันที
  - ห้ามใส่ secret ใน `NEXT_PUBLIC_*` และห้าม commit `.env*` (ยกเว้น `.example`)
- เพิ่ม env ใหม่ต้องแก้สามที่: [app-config.ts](../../apps/api/src/config/app-config.ts), `.env.example` และไฟล์นี้

## runbook.md — คู่มือปฏิบัติงาน

[runbook.md](../runbook.md) คือ "ทำอย่างไรเมื่อ..." มี 7 หัวข้อ

| หัวข้อ | ใช้เมื่อ |
| --- | --- |
| 1–2 ตั้งเครื่อง, Dev | วันแรก, พอร์ตชน |
| 3 Reset ข้อมูล demo | อยากให้ข้อมูลกลับเป็น 5 records ก่อน demo |
| 4 Local staging | deploy, smoke, restart เมื่อแก้ `.env.staging`, rollback, restore backup |
| 5 Jenkins | เปิด Jenkins, login, กด build, อัปเดต plugin |
| 6 Performance | วัดความเร็ว |
| 7 ปัญหาที่พบบ่อย | หน้าเว็บ error, API start ไม่ได้, test ล้มเรื่องสิทธิ์ฐานข้อมูล |

ประโยคที่ควรจำ: **rollback ไม่ย้อน schema** เพราะ migration ออกแบบให้ image เก่ายังใช้ได้ ยกเว้น migration ที่ลบตาราง Login/Reports ซึ่งต้อง restore backup

## decisions.md — ทำไมถึงเลือกแบบนี้

[decisions.md](../decisions.md) เป็นบันทึกการตัดสินใจ (decision log) แต่ละข้อมีรหัส `D-xx` พร้อมเหตุผล D-01 ถึง D-12 มาจาก PRD ส่วน D-13 ขึ้นไปตัดสินใจระหว่างลงมือทำ กติกาคือ **เพิ่มแถวใหม่เท่านั้น ห้ามแก้แถวเก่า** ถ้าเปลี่ยนใจให้เขียนแถวใหม่ว่าแทนที่ข้อไหน

- **อ่านเมื่อ**: มีคนถามว่า "ทำไมไม่ใช้ X" หรือเห็นโค้ดแปลก ๆ แล้วสงสัย

จัดกลุ่มให้อ่านง่าย

| กลุ่ม | ข้อ | สรุปสั้น ๆ |
| --- | --- | --- |
| Stack และเวอร์ชัน | D-01, D-13–D-16 | Next 16 + Nest 12 + Postgres 17 + Prisma 7; ไม่ใช้ `latest` ที่เป็น RC หรือยังไม่เข้ากัน; test ใช้ Vitest + SWC |
| ความถูกต้องของข้อมูล | D-02, D-04, D-05, D-19, D-20, D-22, D-31, D-37 | seed ไม่ทับ, เงินเป็น decimal string, วันที่เป็น string, กฎเป็น pure function, SQL ตรง ๆ เพื่อคุมชนิดข้อมูล, ป้ายบอกชนิดฐาน, reset ใน transaction เดียว |
| การเขียนพร้อมกัน | D-06, D-07, D-21, D-23 | ลบจริง + ยืนยันก่อน, version + If-Match, idempotency ใน transaction เดียว |
| ความปลอดภัยและการเดินระบบ | D-17, D-35, D-36, D-43, D-45 | rate limit เขียนเอง, trust proxy แค่ hop เดียว, ปิด limiter ได้เฉพาะ test, role ฐานข้อมูลแยก, secret ของ test สุ่มใหม่ทุกครั้ง |
| Delivery และ CI/CD | D-10, D-29, D-30, D-33, D-34, D-41, D-44 | staging :3100, Jenkins + agent บนเครื่อง, tag = SHA (`-dirty`), readiness ตรวจ migration, `pnpm run setup`, state ของ staging อยู่ใน home, pin plugin ทุกตัว |
| Performance | D-11, D-32 | 10k records seed 42, วัด baseline ก่อนเพิ่ม index |
| เอกสาร API | D-42 | OpenAPI อธิบาย envelope และ header ครบ |
| ขอบเขต | D-08, D-12, **D-46** | UI อังกฤษ/เอกสารไทย; ไม่ทำ Redis, K8s; **D-46 ตัด Login และ AI reports ออก** |
| ยกเลิกแล้วโดย D-46 (อ่านเป็นประวัติ) | D-03, D-09, D-18, D-24–D-28, D-38–D-40 | Google OAuth, session, สิทธิ์ Admin/Viewer, n8n + Gemini |

## design.md — กติกาหน้าตา UI

[design.md](../design.md) อธิบายว่าทำไม UI หน้าตาเหมือนโปรแกรม ERP/HR ขององค์กร (ตารางแน่น มีเส้นกริดครบ) แทนที่จะเป็น dashboard สำเร็จรูป

- **อ่านเมื่อ**: จะแก้หน้าตาเว็บ
- **ใจความ**
  - สีอยู่ใน `apps/web/src/app/globals.css` เป็นโทนเขียว Chememan สีแดงใช้กับการลบและ error เท่านั้น
  - ฟอนต์ IBM Plex Sans Thai ตระกูลเดียว ขนาด 14 px ตาราง 13 px ตัวเลขใช้ `tabular-nums`
  - ไม่ใช้ของที่ทำให้ดูเป็น template: sidebar ไอคอน, การ์ดลอยมุมโค้ง, badge มีกรอบ, หัวข้อตัวใหญ่, gradient
  - Accessibility: ทุก input มี label, สถานะไม่พึ่งสีอย่างเดียว (Active = จุดทึบ, In Active = วงกลวง), ใช้คีย์บอร์ดได้ครบ

## prd.md — สเปกตั้งต้น

[prd.md](../prd.md) ยาวราว 1,600 บรรทัด เขียนก่อนเริ่มโค้ดเพื่อสั่งงาน AI โค้ดอ้างถึงเป็น `PRD §…` และรหัส `REQ-xx`, `USR-xx`, `AC-xx`

- **อ่านเมื่อ**: อยากรู้ว่าข้อกำหนดเดิมคืออะไร หรือเห็น `PRD §9.4` ในคอมเมนต์แล้วอยากตามไปอ่าน
- **ไม่ต้องอ่านทั้งเล่ม** ใช้ตารางนี้เลือก

| ส่วน | สถานะ | อ่านเพื่อ |
| --- | --- | --- |
| §3–§4 โจทย์และข้อมูล Excel | ใช้อยู่ | รู้ว่าโจทย์ขออะไร และกับดักของข้อมูล (Bob Brown `In Active`, วันที่เดิมต้องคงไว้) |
| §7 Architecture | ใช้อยู่ | ทำไมแยก Next/Nest |
| §8 หน้าจอและ user journey | ใช้อยู่ | หน้า list, create/edit/delete ต้องทำงานอย่างไร |
| §9 Data model และกฎธุรกิจ | ใช้อยู่ | validation, วันเวลา, concurrency, seed |
| §10 API contract | ใช้อยู่ ยกเว้น DTO ของ session/reports ใน §10.6 | endpoint, error code, idempotency |
| §11 Authentication | **ประวัติ** (D-46) | — |
| §12 AI report, n8n, Gemini | **ประวัติ** (D-46) | — |
| §13 Environment และคำสั่ง | ใช้อยู่ (ตัด env ของ auth/AI) | env, health, logging |
| §14 CI/CD | ใช้อยู่ | stage ที่ต้องมีและ rollback policy |
| §15 Performance | ใช้อยู่ | ชุดข้อมูลและเป้าหมาย |
| §16 Acceptance criteria | ใช้อยู่ ยกเว้น §16.4 (AI) และส่วนสิทธิ์ใน §16.3 | รหัส `AC-xx` ที่ test อ้างถึง |
| §17 แผนสำหรับ AI | ใช้อยู่ | ลำดับงานและข้อปฏิบัติของ AI |

## performance.md — ผลวัดความเร็ว อธิบายแบบง่าย

[performance.md](../performance.md) บันทึกการวัดความเร็วด้วยข้อมูล 10,000 records

**คำที่ต้องรู้ก่อน**

- **p95** — ถ้าเรียง 100 คำขอจากเร็วไปช้า p95 คือเวลาของคำขอที่ 95 แปลว่า 95 % ของคำขอเร็วกว่านี้ ใช้แทนค่าเฉลี่ยเพราะสะท้อน "คนที่โชคร้าย" ได้ดีกว่า
- **VU (Virtual User)** — ผู้ใช้จำลองที่ k6 สร้างขึ้นมายิงพร้อมกัน
- **EXPLAIN ANALYZE** — คำสั่งของ PostgreSQL ที่บอกว่า query นั้นถูกรันอย่างไรจริง ๆ (อ่านทั้งตาราง หรือใช้ index) และใช้เวลาเท่าไร
- **Seq Scan** = อ่านทุกแถว, **Index Scan** = ใช้ index ข้ามไปหาแถวที่ต้องการ

**ใจความ**

1. วัดสองแบบด้วย build เดียวกัน: A ไม่มี index เพิ่ม (baseline) กับ B มี index จาก migration `perf_indexes`
2. **ผ่านทุกเป้าหมายทั้งสองแบบ** เช่น list p95 ราว 44–61 ms จากเป้า 300 ms, error 0 %, Lighthouse Performance 100
3. ตัวเลข p95 ของ B เร็วกว่า A แต่ **ส่วนต่างส่วนใหญ่เป็น noise ของเครื่อง** เพราะแม้ endpoint ที่ไม่ได้รับผลจาก index ก็ยังต่างกัน 28 %
4. หลักฐานที่เชื่อได้คือ EXPLAIN ANALYZE
   - filter แผนก+สถานะเปลี่ยนจาก Seq Scan เป็น Bitmap Index Scan บน index `department_id, is_active` ที่เพิ่มเข้าไป (0.85 → 0.38 ms)
   - หน้าค้นหาชื่อเร็วขึ้นจาก 3.16 ms เป็น 0.40 ms **แต่ไม่ได้ใช้ trigram index** planner เลือก Index Scan บน primary key แทน เพราะ index ใหม่ช่วยให้ประมาณจำนวนแถวได้แม่นขึ้น
   - query นับจำนวนของการค้นหายังเป็น Seq Scan อยู่ ที่ 10,000 records ตารางเล็กเกินกว่าที่ planner จะเลือก trigram GIN index
5. ข้อเสีย: trigram index ใหญ่ 3.8 MB (index หลักแค่ 240 kB) ส่วนต้นทุนตอนเขียนยังวัดไม่เห็นที่ 10,000 records แต่จะชัดขึ้นเมื่อข้อมูลโตขึ้น
6. ตัดสินใจเก็บ index ทั้งสองไว้: index แผนก+สถานะเล็กและถูกใช้จริง ส่วน trigram index เก็บไว้รอข้อมูลโตขึ้น (ถ้าข้อมูลเล็กแบบนี้ตลอดก็ drop ได้โดยไม่เสียเป้าหมาย) และไม่ปรับอย่างอื่นเพิ่ม เพราะไม่พบคอขวดที่มีหลักฐาน

ประโยคที่ใช้ตอบคำถามได้: "เพิ่ม index เพราะ EXPLAIN ยืนยันว่า plan เปลี่ยน ไม่ได้ตัดสินจาก p95 อย่างเดียวเพราะ noise สูงพอ ๆ กับส่วนต่าง"

## versions.md — เวอร์ชันที่ใช้จริง

[versions.md](../versions.md) บันทึกเวอร์ชันที่ติดตั้งและรันจริง ไม่ใช่ที่คาดเดา

- **อ่านเมื่อ**: มีคนถามว่าใช้เวอร์ชันอะไร หรือทำไมไม่อัปเกรด
- **ใจความ**: Node 24.21.0, pnpm 12.8.1, TypeScript 5.9.3 (ไม่ใช้ 7 เพราะ `@nestjs/swagger` ยังไม่รองรับ), Prisma 7.10.0 (`latest` เป็น 8.0 RC), ESLint 9 (plugin ของ Next ยังไม่รองรับ 10)

## ai-usage.md — ใช้ AI อย่างไร และ AI พลาดตรงไหน

[ai-usage.md](../ai-usage.md) บันทึกวิธีสั่งงาน AI และปัญหาจริง 20 ข้อที่เจอระหว่างพัฒนา

- **อ่านเมื่อ**: เตรียมตอบคำถามเรื่องการใช้ AI ตอนสัมภาษณ์
- **ใจความ**
  - วิธีทำงาน: ส่ง PRD ทั้งฉบับให้ AI → ตรวจความเข้ากันของเวอร์ชันก่อน → ทำทีละชิ้นพร้อม test → ให้ test เป็นตัวตัดสิน ไม่ใช่การอ่านโค้ด
  - ตัวอย่างที่ AI พลาดแล้ว test จับได้: ช่อง Salary พิมพ์แล้วข้อความต่อท้ายกัน (Playwright จับ), สุ่ม Idempotency-Key ใหม่เมื่อได้ 5xx, เปิด `/api/docs-yaml` โดยไม่ตั้งใจ (reviewer จับ), app role มีสิทธิ์สร้างฐานข้อมูล (reviewer จับ)
  - ข้อ 4, 6, 14, 15 และตัวอย่างใน "สิ่งที่ AI ไม่ได้ทำแทน" เป็นเรื่องของ Login/session/reports ซึ่งถูกตัดออกแล้ว (D-46) อ่านเป็นประวัติ

## demo-script.md — แผนนำเสนอ 15 นาที

[demo-script.md](../demo-script.md) คือบทนำเสนอ

- **อ่านเมื่อ**: ก่อนวันนำเสนอ
- **ใจความ**
  - เตรียมล่วงหน้า: build staging ไว้ก่อน, `pnpm staging:smoke` ต้องผ่าน, reset ให้เหลือ 5 records
  - ลำดับ: เปิดหน้า Employees → ทำ CRUD ตามสคริปต์ → เปิดโค้ด → เล่าเรื่องการใช้ AI → Jenkins + performance → Q&A
  - มีโจทย์ซ้อม Live Coding สองข้อ (filter Join Date และเพิ่ม validation) ซึ่งบท 2 อธิบายลำดับการแก้ไว้
  - คำถามที่ควรตอบได้ อยู่ในบท 10 พร้อมคำตอบ

## ข้อสังเกต: จุดในเอกสารเดิมที่ยังเหลือของเก่า

ระหว่างเขียนคู่มือพบจุดที่ยังพูดถึงระบบที่ตัดออกไปแล้ว หรือไม่ตรงกับโค้ด **ยังไม่ได้แก้ไฟล์เหล่านี้** บันทึกไว้ให้ตัดสินใจเอง

| ที่ | สิ่งที่เห็น | ความจริงตอนนี้ |
| --- | --- | --- |
| [design.md](../design.md) หัวข้อ Layout | แถบเมนูมี "ผู้ใช้/สิทธิ์ + Sign out" | ไม่มีระบบ login แล้ว (D-46) |
| [ai-usage.md](../ai-usage.md) ข้อ 4, 6, 14, 15 และข้อ 2 | ข้อ 4, 6, 14, 15 เป็นเรื่อง OIDC, session, logout, scheduled report; ข้อ 2 ยกตัวอย่าง `AuthenticationGuard` | ข้อ 4, 6, 14, 15 เป็นประวัติก่อน D-46; ข้อ 2 บทเรียนยังใช้ได้ (tsx ทำ DI พัง) แค่ชื่อ class เป็นของเก่า |
| [configuration.md](../configuration.md) แถว `TRUST_PROXY` | ค่า default `loopback, linklocal, uniquelocal` | ค่า default ในโค้ดคือ `private-1hop` ([app-config.ts](../../apps/api/src/config/app-config.ts), D-35) ส่วน staging compose ตั้งเป็น `loopback, linklocal, uniquelocal` เอง |
| [decisions.md](../decisions.md) D-35 | เหตุผลอ้างถึง limit ของ "Google start" | ไม่มี Google login แล้ว แต่การตั้ง trust proxy ยังใช้อยู่ |
| [scripts/staging.mjs](../../scripts/staging.mjs) smoke ข้อสุดท้าย | ตรวจว่า `/internal/v1/report-jobs/claim` ตอบ 404 | route นี้ไม่มีแล้ว จึงผ่านเสมอ ยังใช้เป็นการตรวจว่า path ภายในไม่หลุดได้ |
| ชื่อไฟล์ [admin-crud.spec.ts](../../tests/e2e/specs/admin-crud.spec.ts) และ test บางชื่อ | มีคำว่า Admin | ไม่มีบทบาท Admin แล้ว แค่ชื่อเก่า |
| [http-exception.filter.ts](../../apps/api/src/common/http-exception.filter.ts) | มี mapping 401 "Sign in to continue." และ 403 | mapping ทั่วไปที่ไม่มี route ไหนใช้แล้ว |

ต่อไป: [บท 10 — เตรียมตอบคำถาม](10-qa-prep.md)
