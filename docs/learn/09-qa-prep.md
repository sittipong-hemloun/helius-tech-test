# บท 9 — เตรียมตอบคำถาม

คำถามชุดแรกมาจากรายการ "คำถามที่ควรตอบได้" ใน [demo-script.md](../demo-script.md) ชุดที่สองเป็นคำถามที่คนไม่คุ้นกับ NestJS หรือ OpenAPI มักถูกถาม ทุกคำตอบมีไฟล์ให้เปิดประกอบ

วิธีใช้: อ่านคำตอบแล้วลองพูดด้วยคำของตัวเอง ไม่ต้องท่องจำ ถ้าโดนถามลึกให้เปิดไฟล์ที่ระบุไว้

## คำถามจาก demo-script

### ทำไมแยก Next.js กับ NestJS

> แยกเพื่อให้กฎของข้อมูลมีที่อยู่ที่เดียว Next.js ทำแค่ UI กับส่งต่อ `/api/*` ไม่ต่อฐานข้อมูลและไม่มี Server Actions ทำ CRUD ซ้ำ การตรวจข้อมูล, กฎ version และการแปลงเงิน/วันที่อยู่ใน NestJS ทั้งหมด ผลคือทดสอบ API ได้ตรง ๆ ด้วย integration test โดยไม่ต้องผ่านหน้าเว็บ มี Swagger UI อธิบาย API ให้ และเบราว์เซอร์เห็นแค่ origin เดียวจึงไม่ต้องเปิด CORS

เปิดประกอบ: [next.config.ts](../../apps/web/next.config.ts), [architecture.md](../architecture.md)

### ทำไมเงินเป็น decimal string

> `number` ของ JavaScript เป็น floating point บวกทศนิยมแล้วเพี้ยนได้ เช่น 0.1 + 0.2 ไม่เท่ากับ 0.3 พอดี ฐานข้อมูลจึงเก็บเป็น `numeric(12,2)` Prisma คืนมาเป็น `Decimal` แล้ว service แปลงเป็น string ด้วย `toFixed(2)` ขาเข้า DTO รับเฉพาะ string ที่ตรงรูปแบบ `^\d{1,10}(\.\d{1,2})?$` ถ้าส่งเป็นตัวเลขมาจะได้ 400 การใส่ comma `#,##0.00` ทำตอนแสดงผลในเว็บด้วยการจัดการ string อย่างเดียว ค่าเงินจึงไม่เคยผ่าน float เลยตั้งแต่ฐานข้อมูลจนถึงฟอร์ม

เปิดประกอบ: `toEmployee()` ใน [employees.service.ts](../../apps/api/src/employees/employees.service.ts), `salary` ใน [employee.dto.ts](../../apps/api/src/employees/employee.dto.ts), [salary.ts](../../apps/web/src/lib/salary.ts), D-04

### ป้องกัน lost update อย่างไร

> ใช้ optimistic concurrency ทุกแถวมี `version` ที่ส่งไปกับข้อมูลพนักงาน ตอนแก้หรือลบ client ต้องส่ง version ที่ตัวเองเห็นมาใน header `If-Match` ไม่ส่งได้ 428 ฝั่ง service ใช้ `updateMany` ที่มีเงื่อนไข `where: { id, version }` ซึ่งเป็นคำสั่ง UPDATE เดียวที่ตรวจและเขียนพร้อมกัน ถ้าไม่โดนสักแถวจึงเช็กต่อว่าไม่มี ID นี้ (404) หรือ version เปลี่ยนไปแล้ว (409) มี integration test ยิงแก้พร้อมกัน 3 คำขอด้วย version เดียวกัน ผ่านแค่คำขอเดียว และ E2E test เปิดสองแท็บแก้ record เดียวกัน แท็บที่ช้ากว่าได้แถบเตือนพร้อมปุ่ม Reload latest (AC-16)

เปิดประกอบ: `update()` ใน [employees.service.ts](../../apps/api/src/employees/employees.service.ts), [บท 6 หัวข้อ 1](06-key-concepts.md)

### ทำไมตัดหลายอย่างออก (Login, AI report, CI/CD ฯลฯ)

> โจทย์หลักคือ List, Search/Filter และ CRUD ของข้อมูลจาก Excel ที่รันในเครื่องได้ และโค้ดต้องอธิบายและแก้สดได้ ของหลายอย่างเคยทำไว้ตาม PRD ตั้งต้นแต่ตัดออกเป็นสามรอบ บันทึกไว้ทุกครั้ง
>
> - **D-46** ตัดระบบ Login (Google OAuth, Admin/Viewer) และรายงาน AI (n8n + Gemini)
> - **D-52** ตัดชุด performance test
> - **D-56** ตัด delivery (Jenkins, staging, Docker image, Postman) และของกันพังระดับ production ที่โจทย์ไม่ได้ขอ (Idempotency-Key, rate limit, envelope ของ response, health check, generated client) แล้วเขียน API ใหม่ด้วย Prisma client และ DTO มาตรฐานของ NestJS
>
> สิ่งที่ยังคงไว้คือเรื่องที่ทำให้ข้อมูลถูกต้อง ได้แก่ `version` + `If-Match`, เงินเป็น string, วันที่เป็น `YYYY-MM-DD` และ "วันนี้" ตามเวลากรุงเทพ

เปิดประกอบ: D-46, D-52, D-56 ใน [decisions.md](../decisions.md), migration [remove_login_and_reports](../../apps/api/prisma/migrations/20261003000000_remove_login_and_reports/migration.sql) และ [simplify](../../apps/api/prisma/migrations/20261005000000_simplify/migration.sql)

### ทำไม seed ไม่ stamp วันที่ใหม่

> Last Updated Date ใน Excel เป็นข้อมูลตั้งต้นของโจทย์ ถ้า seed เปลี่ยนเป็นวันที่รัน ข้อมูลจะไม่ตรงต้นฉบับ PRD §4.3 ระบุให้คง ID และวันที่แก้ไขเดิมของทั้ง 5 รายการ seed จึงใส่ค่าจาก Excel ตรง ๆ และทำงานเฉพาะเมื่อตาราง employees ว่าง จึงไม่ทับข้อมูลที่ถูกแก้แล้ว วันที่จะเปลี่ยนเป็น "วันนี้ตามเวลากรุงเทพ" ก็ต่อเมื่อผู้ใช้สร้างหรือแก้ record ผ่านระบบเท่านั้น ถ้าอยากเริ่มใหม่ใช้ `pnpm db:reset`

เปิดประกอบ: [seed.ts](../../apps/api/src/seed.ts), [seed.test.ts](../../apps/api/test/unit/seed.test.ts), integration test "seeding again adds nothing and keeps edited values"

### AI ทำอะไรผิดจริงบ้าง

> บันทึกไว้ใน ai-usage.md พร้อมหลักฐาน ตัวอย่างที่ยังเกี่ยวกับโค้ดปัจจุบัน:
>
> 1. จะติดตั้ง Prisma 8 RC เพราะ `latest` ชี้ไป RC ต้อง pin 7.10.0
> 2. รันโค้ด Nest ด้วย `tsx` แล้ว DI พัง เพราะ esbuild ไม่สร้าง decorator metadata จึงใช้ SWC ใน test
> 3. ช่อง Salary format ตอน focus ทำให้พิมพ์ใหม่แล้วข้อความต่อท้าย `62000.0063000.00` Playwright จับได้
> 4. ตอนเปลี่ยนเป็น Prisma `contains` ค้นหา `%` แล้วได้ทุกแถว เพราะ Prisma ไม่ escape ให้ integration test AC-23 จับได้
> 5. `PATCH {"name": null}` ได้ 500 แทน 400 เพราะ `PartialType` ข้ามค่า `null` แก้ด้วย `skipNullProperties: false`
>
> บทเรียนคือให้ test เป็นตัวตัดสิน ไม่เชื่อแค่การอ่านโค้ดหรือคำอธิบายของ AI

เปิดประกอบ: [ai-usage.md](../ai-usage.md)

## คำถามพื้นฐานที่อาจโดนถาม

### NestJS ต่างจาก Express อย่างไร

> Nest ใช้ Express อยู่ข้างใน แต่เพิ่มโครงสร้าง: Module รวมของที่เกี่ยวข้อง, Controller รับ HTTP, Service ทำงานจริง และมี Dependency Injection สร้างของให้ งานที่ต้องทำกับทุก request เช่นตรวจข้อมูล ทำผ่าน Pipe (`ValidationPipe` + DTO) และ error ก็โยนเป็น exception แล้ว Nest แปลงเป็น response ให้ โค้ดจึงไม่กองรวมในที่เดียว

เปิดประกอบ: [บท 2](02-nestjs.md), [app.ts](../../apps/api/src/app.ts)

### Dependency Injection มีประโยชน์อะไรในโปรเจกต์นี้

> `EmployeesService` ไม่ได้สร้างการเชื่อมต่อฐานข้อมูลเอง แต่ขอ `PrismaService` ผ่าน constructor Nest สร้างให้ตัวเดียวแล้วใช้ร่วมกันทั้งแอป และเรียก `onModuleDestroy()` ปิดการเชื่อมต่อให้ตอนแอปหยุด ถ้าวันหนึ่งอยากเปลี่ยนตัวที่ใช้คุยกับฐานข้อมูลใน test ก็ทำผ่าน DI ได้โดยไม่แก้ service

เปิดประกอบ: [prisma.service.ts](../../apps/api/src/prisma/prisma.service.ts), [prisma.module.ts](../../apps/api/src/prisma/prisma.module.ts)

### OpenAPI / Swagger ใช้ทำอะไร

> `@nestjs/swagger` อ่าน decorator ใน controller และ DTO แล้วสร้างเอกสาร OpenAPI ตอนแอปเริ่ม เปิดดูและลองยิงได้ที่ `/api/docs` เอกสารจึงตรงกับโค้ดเสมอเพราะมาจากที่เดียวกัน ส่วน type ฝั่งเว็บเขียนเองใน `lib/api.ts` เพราะ API มีแค่ 5 endpoint การ generate client แยกเป็นภาระมากกว่าประโยชน์ (ตัดออกใน D-56) แลกกับการที่ต้องจำแก้ type สองฝั่งพร้อมกัน

เปิดประกอบ: [บท 4](04-openapi.md), [api.ts](../../apps/web/src/lib/api.ts)

### ป้องกัน SQL injection อย่างไร

> ใช้ Prisma client ซึ่งส่งค่าที่ผู้ใช้พิมพ์เป็น parameter แยกจาก SQL เสมอ ชื่อคอลัมน์ที่ใช้เรียงต้องผ่าน `@IsIn(SORT_FIELDS)` แล้วเลือกจาก map `ORDER_BY` เท่านั้น คำค้นหาชื่อ escape `%` กับ `_` ก่อนส่งให้ `contains` และ `ValidationPipe` ปฏิเสธ query ที่ไม่รู้จัก มี integration test ค้น `' OR 1=1 --` และ `%` แล้วได้ 0 แถว (AC-23)

เปิดประกอบ: `list()` ใน [employees.service.ts](../../apps/api/src/employees/employees.service.ts), [บท 3](03-database-prisma.md)

### ถ้ากดสร้างแล้วเน็ตหลุด จะได้ข้อมูลซ้ำไหม

> อาจได้ ถ้าคำขอไปถึง server และบันทึกแล้วแต่คำตอบหายระหว่างทาง แล้วผู้ใช้กด Save ซ้ำ เดิมเคยมี Idempotency-Key กันกรณีนี้ แต่ตัดออกใน D-56 เพราะโจทย์ไม่ได้ขอและเป็นแอปในเครื่อง หน้าเว็บจะขึ้นข้อความว่าติดต่อ server ไม่ได้ ผู้ใช้ควรเปิดรายการดูก่อนกดซ้ำ ถ้าซ้ำจริงก็ลบได้ปกติ ถ้าระบบต้องใช้จริงหลายคน ควรนำ Idempotency-Key กลับมา

เปิดประกอบ: D-56 ใน [decisions.md](../decisions.md), [new-employee-view.tsx](../../apps/web/src/app/(console)/employees/new/new-employee-view.tsx)

### test ไปลบข้อมูล dev ได้ไหม

> ปกติไม่ได้ test ใช้ฐานแยก `TEST_DATABASE_URL` integration test ตั้ง `DATABASE_URL` เป็นฐาน test ก่อนเปิดแอป และ `setup.ts` ปฏิเสธถ้าสอง URL เป็นฐานเดียวกัน ส่วน E2E runner ก็ตั้ง `DATABASE_URL` เป็นฐาน test ให้ทั้ง API และคำสั่ง reset แต่การป้องกันมีแค่นี้ ถ้าตั้ง `TEST_DATABASE_URL` ชี้ไปฐานอื่นที่มีข้อมูลจริง test จะลบข้อมูลนั้น จึงต้องตั้งค่าตาม `.env.example`

เปิดประกอบ: [setup.ts](../../apps/api/test/integration/setup.ts), [run.mjs](../../tests/e2e/run.mjs), [configuration.md](../configuration.md)

### มี index อะไรบ้าง และใช้หลักฐานอะไรเลือก

> มีสองตัวใน migration `perf_indexes` ตัวแรกเป็น B-tree บน `(department_id, is_active)` ใช้กับตัวกรองแผนก+สถานะ `EXPLAIN` แสดงว่าใช้ index นี้จริง ตัวที่สองเป็น trigram index บน `lower(name)` ซึ่งทำไว้ตอน query ยังเป็น SQL ที่เขียนเองแบบ `lower(name) LIKE ...` หลังเปลี่ยนเป็น Prisma `contains` ที่สร้าง `name ILIKE ...` index นี้ไม่ถูกใช้แล้ว ตอบตรง ๆ ได้ว่ากับข้อมูลหลักสิบแถวไม่มีผล ถ้าข้อมูลโตจริงควรวัดด้วย `EXPLAIN ANALYZE` แล้วสร้าง trigram index บน `name` ใน migration ใหม่ (migration เก่าห้ามแก้)

เปิดประกอบ: [perf_indexes migration](../../apps/api/prisma/migrations/20261002000000_perf_indexes/migration.sql), D-32, [บท 3](03-database-prisma.md)

### ถ้าต้องเพิ่ม feature ใหม่ จะทำตรงไหน

> ฝั่ง API สร้าง folder `apps/api/src/<feature>` ที่มี module, controller, service และ dto แบบเดียวกับ `employees` แล้วเพิ่ม module เข้า `imports` ของ `AppModule` ถ้าต้องมีตารางใหม่ก็แก้ `schema.prisma` และเพิ่ม migration ใหม่ ฝั่งเว็บเพิ่ม type ใน `lib/api.ts`, hook ใน `lib/queries.ts` แล้วทำ component ใน `components/<feature>` และหน้าใน `app/` ปิดท้ายด้วย integration test และ E2E ถ้าเป็นแค่ตัวกรองใหม่ของ employees ดูสูตรในบท 2

เปิดประกอบ: [app.module.ts](../../apps/api/src/app.module.ts), [queries.ts](../../apps/web/src/lib/queries.ts), [บท 2 หัวข้อสูตร](02-nestjs.md)

## ถ้าโดนถามสิ่งที่ไม่รู้

- บอกตรง ๆ ว่าส่วนนั้นยังไม่ได้ลงลึก แล้วชี้ว่าจะหาคำตอบจากที่ไหน เช่น "การตัดสินใจนี้บันทึกไว้ใน decisions.md ขอเปิดดูครับ"
- เปิดโค้ดจริงแทนการเดา ทุกเรื่องในคู่มือนี้มีลิงก์ไปไฟล์
- ใช้ test เป็นหลักฐาน: ค้นรหัส `AC-xx` แล้วเปิด test ที่เกี่ยวข้องให้ดู

กลับไป: [สารบัญ](README.md)
