# บท 10 — เตรียมตอบคำถาม

คำถามชุดแรกมาจากรายการ "คำถามที่ควรตอบได้" ใน [demo-script.md](../demo-script.md) ชุดที่สองเป็นคำถามที่คนไม่คุ้นกับ NestJS, OpenAPI หรือ Jenkins มักถูกถาม ทุกคำตอบมีไฟล์ให้เปิดประกอบ

วิธีใช้: อ่านคำตอบแล้วลองพูดด้วยคำของตัวเอง ไม่ต้องท่องจำ ถ้าโดนถามลึกให้เปิดไฟล์ที่ระบุไว้

## คำถามจาก demo-script

### ทำไมแยก Next.js กับ NestJS

> แยกเพื่อให้กฎธุรกิจมีที่อยู่ที่เดียว Next.js ทำแค่ UI กับส่งต่อ `/api/*` ไม่ต่อฐานข้อมูลและไม่มี Server Actions ทำ CRUD ซ้ำ ทุกการตรวจข้อมูล, concurrency และ error code อยู่ใน NestJS ผลคือทดสอบ API ได้ตรง ๆ ด้วย integration test กับ Postman โดยไม่ต้องผ่านหน้าเว็บ มี OpenAPI เป็นสัญญาระหว่างสองฝั่ง และบน staging พอร์ตของ API ไม่ต้องเปิดออกนอก Docker เลย เบราว์เซอร์เห็นแค่ origin เดียว

เปิดประกอบ: [next.config.ts](../../apps/web/next.config.ts), [architecture.md](../architecture.md), [compose.staging.yaml](../../compose.staging.yaml)

### ทำไมเงินเป็น decimal string

> `number` ของ JavaScript เป็น floating point บวกทศนิยมแล้วเพี้ยนได้ เช่น 0.1 + 0.2 ไม่เท่ากับ 0.3 พอดี ฐานข้อมูลจึงเก็บเป็น `numeric(12,2)` แล้วส่งออกเป็น string ด้วย `salary::text` และรับเข้าเป็น string เท่านั้น ถ้าส่งเป็นตัวเลขมาจะได้ 400 `SALARY_TYPE_INVALID` การใส่ comma `#,##0.00` ทำตอนแสดงผลในเว็บอย่างเดียว ค่าจริงไม่เคยผ่าน float เลยตั้งแต่ฐานข้อมูลจนถึงฟอร์ม

เปิดประกอบ: `salaryRule` ใน [employee-rules.ts](../../apps/api/src/employees/employee-rules.ts), [salary.ts](../../apps/web/src/lib/salary.ts), D-04

### ทำไมตัด Login และ AI report ออก

> โจทย์หลักคือ List, Search/Filter และ CRUD ของข้อมูลจาก Excel ระบบ Login แบบ Google OAuth และรายงาน AI ผ่าน n8n + Gemini อยู่ใน PRD ตั้งต้น และเคยทำไว้แล้ว แต่ตัดสินใจตัดออกเพื่อให้โปรเจกต์เรียบง่ายและตรงโจทย์ บันทึกเป็น D-46 พร้อม migration ที่ลบตารางที่เกี่ยวข้อง และเปลี่ยน rate limit จากต่อ session เป็นต่อ IP

เสริมได้ถ้าตรงกับเหตุผลจริงของคุณ (ข้อนี้ไม่ได้บันทึกไว้ใน D-46): สองระบบนี้ต้องใช้บัญชี Google และ Gemini API key ภายนอก เมื่อตัดออกแล้วเดโมได้ในเครื่องทั้งหมด

เปิดประกอบ: D-46 ใน [decisions.md](../decisions.md), [migration remove_login_and_reports](../../apps/api/prisma/migrations/20261003000000_remove_login_and_reports/migration.sql)

### ทำไม seed ไม่ stamp วันที่ใหม่

> Last Updated Date ใน Excel เป็นข้อมูลตั้งต้นของโจทย์ ถ้า seed เปลี่ยนเป็นวันที่รัน ข้อมูลจะไม่ตรงต้นฉบับ PRD §4.3 ระบุไว้ว่าต้องคง ID และวันที่แก้ไขเดิมของทั้ง 5 รายการ seed จึงใส่ค่าจาก Excel ตรง ๆ และเติมเฉพาะ ID ที่ยังไม่มี ไม่ทับข้อมูลที่ถูกแก้แล้ว วันที่จะเปลี่ยนเป็น "วันนี้ตามเวลากรุงเทพ" ก็ต่อเมื่อผู้ใช้สร้างหรือแก้ record ผ่านระบบเท่านั้น

เปิดประกอบ: [seed-original.ts](../../apps/api/src/seed/seed-original.ts), [seed-mapping.test.ts](../../apps/api/test/unit/seed-mapping.test.ts), D-02

### ป้องกัน lost update อย่างไร

> ใช้ optimistic concurrency ทุกแถวมี `version` ตอนอ่าน API ส่ง `ETag` เป็นเลข version ตอนแก้หรือลบ client ต้องส่ง `If-Match` กลับมา ไม่ส่งได้ 428 ส่ง version เก่าได้ 409 `VERSION_CONFLICT` ฝั่ง service ทำใน transaction ล็อกแถวด้วย `SELECT ... FOR UPDATE` แล้ว UPDATE แบบมีเงื่อนไข `WHERE version = expected` อีกชั้น มี E2E test เปิดสองแท็บแก้ record เดียวกัน แท็บที่ช้ากว่าต้องได้ข้อความให้ reload (AC-16)

เปิดประกอบ: `update()` ใน [employees.service.ts](../../apps/api/src/employees/employees.service.ts), [บท 7 หัวข้อ 2](07-key-concepts.md)

### ใช้หลักฐานอะไรตัดสินใจเพิ่ม index

> วัด baseline ก่อนด้วย build เดียวกันแต่ไม่มี index (`--without-perf-indexes`) แล้ววัดซ้ำหลังเพิ่ม ทั้งสองแบบผ่านเป้าหมายอยู่แล้ว และตัวเลข p95 แกว่งพอ ๆ กับส่วนต่าง จึงไม่ใช้ p95 เป็นหลักฐาน หลักฐานจริงคือ EXPLAIN ANALYZE ที่แสดงว่า filter แผนก+สถานะเปลี่ยนจาก Seq Scan เป็น Index Scan บน index ที่เพิ่มเข้าไป จึงเก็บ index นี้ ส่วน trigram index สำหรับค้นหาชื่อ ที่ 10,000 records planner ยังไม่เลือกใช้ (หน้าค้นหาเร็วขึ้นจาก 3 ms เป็น 0.4 ms เพราะเปลี่ยนไปใช้ primary key ไม่ใช่เพราะ trigram และ query นับจำนวนยังเป็น Seq Scan) จึงบันทึกไว้ตรง ๆ ว่ายังไม่ถูกใช้ เก็บไว้รอข้อมูลโตขึ้น และ drop ได้ถ้าข้อมูลเล็กแบบนี้ตลอด ข้อเสียคือ trigram index กินที่ 3.8 MB และมีต้นทุนตอนเขียน index อยู่ใน migration แยก จึง rollback หรือเทียบ baseline ได้

เปิดประกอบ: [performance.md](../performance.md), [perf_indexes migration](../../apps/api/prisma/migrations/20261002000000_perf_indexes/migration.sql), D-32

### AI ทำอะไรผิดจริงบ้าง

> มีบันทึกไว้ 20 ข้อ ตัวอย่างที่เล่าง่าย:
> 1. จะติดตั้ง Prisma 8 RC เพราะ `latest` ชี้ไป RC ต้อง pin 7.10.0
> 2. รันสคริปต์ OpenAPI ด้วย `tsx` แล้ว Nest DI พัง เพราะ esbuild ไม่สร้าง decorator metadata
> 3. ช่อง Salary format ตอน focus ทำให้พิมพ์ใหม่แล้วข้อความต่อท้าย `62000.0063000.00` Playwright จับได้
> 4. ฟอร์มสร้างพนักงานสุ่ม Idempotency-Key ใหม่เมื่อได้ 5xx ซึ่งอาจทำให้สร้างซ้ำ แก้ให้เก็บ key เดิมเมื่อไม่รู้ผล
> 5. reviewer subagent จับได้ว่า app role มีสิทธิ์สร้างฐานข้อมูล จึงแยก test role
>
> บทเรียนคือให้ test เป็นตัวตัดสิน ไม่เชื่อแค่การอ่านโค้ดหรือคำอธิบายของ AI

เปิดประกอบ: [ai-usage.md](../ai-usage.md)

## คำถามพื้นฐานที่อาจโดนถาม

### NestJS ต่างจาก Express อย่างไร

> Nest ใช้ Express อยู่ข้างใน แต่เพิ่มโครงสร้าง: Module รวมของที่เกี่ยวข้อง, Controller รับ HTTP, Service ทำงานจริง และมี Dependency Injection สร้างของให้ นอกจากนี้มีจุดเสียบมาตรฐานสำหรับงานที่ต้องทำกับทุก request คือ Guard (rate limit), Pipe (validation), Interceptor (ห่อ response) และ Exception Filter (แปลง error) โค้ดจึงไม่กองรวมในที่เดียว และทดสอบแต่ละชั้นได้

### Dependency Injection มีประโยชน์อะไรในโปรเจกต์นี้

> ตัวอย่างชัดที่สุดคือ `Clock` service ไม่ได้เรียก `new Date()` เอง แต่ขอ `Clock` ผ่าน constructor ตอนรันจริงได้ `SystemClock` ตอน test ได้ `FakeClock` ที่ตรึงเวลาไว้ ทำให้ทดสอบ "Last Updated Date = วันนี้ตามเวลากรุงเทพ" และกรณีใกล้เที่ยงคืนได้แน่นอนทุกครั้ง

เปิดประกอบ: [clock.ts](../../apps/api/src/common/clock.ts), [harness.ts](../../apps/api/test/support/harness.ts)

### OpenAPI ใช้ทำอะไร

> เป็นเอกสารสัญญาของ API ที่สร้างจาก decorator ในโค้ด ไม่ได้เขียนมือ คำสั่ง `pnpm openapi:generate` สร้าง `openapi.json` แล้วแปลงเป็น TypeScript type ให้เว็บ import ใช้ ถ้า API เปลี่ยน type ของเว็บก็เปลี่ยนตามและ typecheck จับได้ทันที Jenkins ยัง generate ซ้ำแล้วเทียบกับที่ commit ไว้ ถ้าไม่ตรง pipeline ล้ม จึงไม่มีทางที่เอกสารกับโค้ดหลุดกัน และเปิดดูแบบโต้ตอบได้ที่ `/api/docs`

### Jenkins pipeline มีกี่ขั้น ทำอะไรบ้าง

> Checkout → ติดตั้ง dependency → static checks (lint, typecheck, scan secret, ตรวจ OpenAPI drift) → unit test → เปิดฐานข้อมูลเฉพาะ build → integration + Postman → build → E2E → build Docker image ติด tag เป็น commit SHA → ถ้าเป็น main ก็ deploy staging แล้ว smoke test ถ้า smoke ไม่ผ่านจะ rollback ไป image ก่อนหน้าอัตโนมัติ ทุกขั้นเรียกคำสั่ง `pnpm` เดียวกับที่รันในเครื่อง

เปิดประกอบ: [Jenkinsfile](../../Jenkinsfile), [บท 6](06-jenkins.md)

### ทำไม image tag เป็น commit SHA ไม่ใช่ `latest`

> ดู tag แล้วรู้ทันทีว่า staging รันโค้ดจาก commit ไหน และ rollback ได้ด้วยการสลับกลับไป tag ก่อนหน้า ถ้าใช้ `latest` ทุก build จะทับกัน ไม่รู้ว่าตัวที่รันอยู่คือรุ่นไหน ถ้า build ตอนแก้ไฟล์ที่ git track อยู่แต่ยังไม่ commit tag จะเป็น `<sha>-dirty` เพื่อไม่ให้อ้างว่าเป็น commit นั้นตรง ๆ (D-30)

### rollback แล้วฐานข้อมูลย้อนด้วยไหม

> ไม่ย้อน migration ออกแบบให้เป็นแบบ expand คือเพิ่มอย่างเดียว image เก่ายังทำงานกับ schema ใหม่ได้ ข้อยกเว้นคือ migration ที่ลบตาราง Login/Reports ถ้าจะย้อนไป image ที่เก่ากว่านั้นต้อง restore backup ที่ทำไว้ก่อน migrate ซึ่ง `staging:up` ทำ `pg_dump` ให้ทุกครั้ง

เปิดประกอบ: [runbook.md](../runbook.md) หัวข้อ 4

### กดสร้างแล้วเน็ตหลุด จะได้ข้อมูลซ้ำไหม

> ไม่ซ้ำ ทุกการสร้างส่ง `Idempotency-Key` เป็น UUID ที่สุ่มครั้งเดียวต่อความตั้งใจ server เก็บ key กับผลลัพธ์ไว้ใน transaction เดียวกับการสร้าง ถ้าส่งซ้ำด้วย key เดิม server ส่งผลเดิมกลับพร้อม `Idempotency-Replayed: true` ฝั่งเว็บเก็บ key เดิมไว้เมื่อไม่รู้ผล (network error หรือ 5xx) มีทั้ง integration test ยิงพร้อมกัน 5 ครั้ง และ E2E test จำลอง response หาย (AC-20)

### ป้องกัน SQL injection อย่างไร ในเมื่อใช้ `$queryRaw`

> `$queryRaw` ของ Prisma เป็น tagged template ค่าใน `${}` ถูกส่งเป็น parameter ไม่ได้ต่อเป็น string ส่วนคอลัมน์ที่ใช้เรียง (ซึ่งเป็น parameter ไม่ได้) เลือกจาก whitelist `SORT_SQL` เท่านั้น และคำค้นหาชื่อ escape `%` กับ `_` ก่อนใส่ `LIKE` มี Postman test ยืนยันว่าค้น `%` แล้วได้ 0 แถว ไม่ใช่ทุกแถว (AC-23)

### test ไปลบข้อมูล dev ได้ไหม

> ไม่ได้ ทุก runner สร้างฐานข้อมูลชั่วคราวของตัวเองด้วย test role ที่สร้างได้เฉพาะฐานชื่อ `employee_console_test_*` ก่อนลบข้อมูลยังตรวจป้าย `app_meta.database_purpose` ต้องเป็น `test` ส่วน app role ที่แอปใช้สร้างหรือลบฐานข้อมูลไม่ได้เลย ใน Jenkins แต่ละ build ยังมี Compose project ของตัวเองที่ลบทิ้งหลังจบ

## ถ้าโดนถามสิ่งที่ไม่รู้

- บอกตรง ๆ ว่าส่วนนั้นยังไม่ได้ลงลึก แล้วชี้ว่าจะหาคำตอบจากที่ไหน เช่น "การตัดสินใจนี้บันทึกไว้ใน decisions.md ขอเปิดดูครับ"
- เปิดโค้ดจริงแทนการเดา ทุกเรื่องในคู่มือนี้มีลิงก์ไปไฟล์
- ใช้ test เป็นหลักฐาน: ค้นรหัส `AC-xx` แล้วเปิด test ที่เกี่ยวข้องให้ดู

กลับไป: [สารบัญ](README.md)
