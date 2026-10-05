# อภิธานศัพท์

เรียงตามหมวด แต่ละคำบอกความหมายสั้น ๆ และบทที่อธิบายละเอียด

## เว็บและ HTTP

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Request / Response | คำขอที่ส่งไป และคำตอบที่ได้กลับ ประกอบด้วย method, path, header, body / status code, header, body | [1](01-big-picture.md) |
| Method | คำกริยาของ HTTP: `GET` อ่าน, `POST` สร้าง, `PATCH` แก้บางส่วน, `DELETE` ลบ | [1](01-big-picture.md) |
| Status code | ตัวเลขสามหลักบอกผล เช่น 200 สำเร็จ, 404 ไม่พบ, 409 ชนกัน, 428 ขาด `If-Match` | [1](01-big-picture.md) |
| Header | ข้อมูลประกอบ request/response เช่น `Content-Type`, `If-Match` | [1](01-big-picture.md) |
| JSON | รูปแบบข้อมูลที่ส่งไปมา หน้าตาเหมือน object ของ JavaScript | [1](01-big-picture.md) |
| REST | แนวคิดที่มองข้อมูลเป็น resource มี URL ของตัวเอง แล้วใช้ method บอกการกระทำ | [1](01-big-picture.md) |
| Origin | scheme + host + port เช่น `http://localhost:3000` เบราว์เซอร์แยกสิทธิ์ตาม origin | [1](01-big-picture.md) |
| CORS | กลไกที่อนุญาตให้หน้าเว็บเรียก origin อื่น โปรเจกต์นี้ไม่เปิดเพราะใช้ origin เดียว | [1](01-big-picture.md) |
| Rewrite / Proxy | Next.js รับคำขอ `/api/*` แล้วส่งต่อให้ NestJS โดยเบราว์เซอร์ไม่รู้ | [1](01-big-picture.md) |
| If-Match | header ที่ client ส่ง version ที่ตัวเองเห็นกลับมา เพื่อให้ server ตรวจก่อนแก้หรือลบ | [6](06-key-concepts.md) |
| ETag | header บอก "รุ่น" ของ response ในโปรเจกต์นี้ Express สร้างให้อัตโนมัติจากเนื้อหา **ไม่ใช่** เลข version | [2](02-nestjs.md) |
| Query string | ส่วนหลัง `?` ของ URL เช่น `?q=john&page=2` หน้า list เก็บสถานะไว้ตรงนี้ | [6](06-key-concepts.md) |

## NestJS

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Decorator | ป้าย `@...` ที่แปะบน class/method/property บอก framework ว่าโค้ดนั้นคืออะไร | [2](02-nestjs.md) |
| Module | กล่องที่รวม controller และ provider ของเรื่องเดียวกัน | [2](02-nestjs.md) |
| Controller | class ที่รับ HTTP request แกะข้อมูล แล้วเรียก service | [2](02-nestjs.md) |
| Provider / Service | class ที่ Nest สร้างแล้วแจกจ่ายผ่าน DI; service คือที่อยู่ของงานจริง | [2](02-nestjs.md) |
| Dependency Injection (DI) | ขอของที่ต้องใช้ผ่าน constructor แล้ว Nest สร้างและส่งให้ | [2](02-nestjs.md) |
| `@Global()` | module ที่ทุก module ใช้ของได้โดยไม่ต้อง import เช่น `PrismaModule` | [2](02-nestjs.md) |
| Global prefix | คำนำหน้าทุก route ตั้งด้วย `app.setGlobalPrefix('api')` | [2](02-nestjs.md) |
| Pipe | ตรวจและแปลงข้อมูลก่อนถึง controller เช่น `ValidationPipe`, `ParseIntPipe` | [2](02-nestjs.md) |
| DTO | class ที่นิยามหน้าตาของ body/query เช่น `CreateEmployeeDto` | [2](02-nestjs.md) |
| class-validator | library ที่ให้เขียนกฎเป็น decorator เช่น `@IsString()`, `@Matches()` | [2](02-nestjs.md) |
| `PartialType` | สร้าง DTO ที่ทุกฟิลด์ไม่บังคับจาก DTO เดิม ใช้กับ `UpdateEmployeeDto` | [2](02-nestjs.md) |
| Exception | สิ่งที่ `throw` เพื่อหยุดคำขอ เช่น `NotFoundException` แล้ว Nest แปลงเป็น `{ statusCode, message, error }` | [2](02-nestjs.md) |
| Decorator metadata | ข้อมูลชนิดของ constructor ที่ compiler ฝังไว้ให้ DI อ่าน esbuild/tsx ไม่สร้างให้ | [2](02-nestjs.md) |

## ฐานข้อมูล

| คำ | ความหมาย | บท |
| --- | --- | --- |
| ORM | เครื่องมือที่ให้เขียนโค้ดแทน SQL พร้อม type (โปรเจกต์นี้ใช้ Prisma) | [3](03-database-prisma.md) |
| Schema (`schema.prisma`) | ไฟล์นิยามตารางและคอลัมน์ | [3](03-database-prisma.md) |
| Prisma client | โค้ดที่ `prisma generate` สร้างจาก schema ใช้สั่ง `findMany`, `updateMany` ฯลฯ | [3](03-database-prisma.md) |
| Migration | ไฟล์ SQL ที่เปลี่ยนโครงสร้างฐานข้อมูลทีละขั้น เพิ่มได้อย่างเดียว | [3](03-database-prisma.md) |
| Seed | การใส่ข้อมูลตั้งต้น (5 records จาก Excel) | [3](03-database-prisma.md) |
| Transaction | ชุดคำสั่งที่สำเร็จทั้งหมดหรือไม่เกิดอะไรเลย | [3](03-database-prisma.md) |
| Index | โครงสร้างช่วยค้นหาเร็ว เหมือนสารบัญท้ายหนังสือ | [3](03-database-prisma.md) |
| Trigram index | index ที่ช่วยค้นหาข้อความแบบ "มีคำนี้อยู่ข้างใน" (`LIKE '%...%'`) | [3](03-database-prisma.md) |
| `ILIKE` | `LIKE` แบบไม่สนตัวพิมพ์เล็กใหญ่ Prisma `contains` + `mode: 'insensitive'` สร้างคำสั่งนี้ | [3](03-database-prisma.md) |
| `numeric(12,2)` | ชนิดตัวเลขทศนิยมแม่นยำ 12 หลัก ทศนิยม 2 ตำแหน่ง | [6](06-key-concepts.md) |
| `Decimal` | object ที่ Prisma ใช้แทนค่า `numeric` แปลงเป็น string ด้วย `toFixed(2)` | [3](03-database-prisma.md) |
| Date-only | วันที่ที่ไม่มีเวลาและ timezone เช่น `2023-01-15` | [6](06-key-concepts.md) |
| SQL injection | การโจมตีด้วยการแทรก SQL ผ่านค่าที่ผู้ใช้ส่งมา ป้องกันด้วย parameter | [3](03-database-prisma.md) |

## OpenAPI

| คำ | ความหมาย | บท |
| --- | --- | --- |
| OpenAPI | มาตรฐานเอกสาร API เป็น JSON/YAML บอก path, parameter, body, response | [4](04-openapi.md) |
| Swagger | ชื่อเดิมของ OpenAPI และชุดเครื่องมือ เช่น Swagger UI | [4](04-openapi.md) |
| Swagger UI | หน้าเว็บที่แสดงเอกสาร API และกดลองยิงได้ (`/api/docs`) | [4](04-openapi.md) |
| Schema (OpenAPI) | นิยามหน้าตาของข้อมูลชนิดหนึ่ง เช่น `CreateEmployeeDto` | [4](04-openapi.md) |

## Docker

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Image | แม่พิมพ์ของโปรแกรมที่แพ็กพร้อมรัน แก้ข้างในไม่ได้ เช่น `postgres:17.11-bookworm` | [5](05-docker.md) |
| Container | image ที่กำลังรันอยู่ | [5](05-docker.md) |
| Volume | ที่เก็บข้อมูลถาวรนอก container | [5](05-docker.md) |
| Compose | ไฟล์ YAML ที่บอกว่าจะเปิด container อะไร ตั้งค่าอย่างไร (`compose.yaml`) | [5](05-docker.md) |
| Healthcheck | คำสั่งที่ Docker ใช้ตรวจว่า container พร้อมหรือยัง | [5](05-docker.md) |

## การทดสอบ

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Unit test | ทดสอบฟังก์ชันหรือกฎเล็ก ๆ ไม่ใช้ฐานข้อมูล | [7](07-testing.md) |
| Integration test | ทดสอบ API ทั้งก้อนกับฐานข้อมูลจริง | [7](07-testing.md) |
| E2E test | ทดสอบผ่านเบราว์เซอร์จริงเหมือนผู้ใช้ | [7](07-testing.md) |
| Vitest | ตัวรัน test ของ JavaScript/TypeScript | [7](07-testing.md) |
| Supertest | library ยิง HTTP เข้าแอป Nest ใน test | [7](07-testing.md) |
| Playwright | เครื่องมือควบคุมเบราว์เซอร์สำหรับ E2E | [7](07-testing.md) |
| Fake timers | `vi.useFakeTimers` ตรึงเวลาของ `Date` ใน test ให้ผลเหมือนเดิมทุกวัน | [7](07-testing.md) |
| AC-xx | รหัส acceptance criteria ใน PRD ที่ชื่อ test อ้างถึง | [7](07-testing.md) |

## เฉพาะโปรเจกต์นี้

| คำ | ความหมาย | บท |
| --- | --- | --- |
| D-xx | รหัสการตัดสินใจใน [decisions.md](../decisions.md) | [8](08-docs-guide.md) |
| PRD §x.y | อ้างถึงหัวข้อใน [prd.md](../prd.md) | [8](08-docs-guide.md) |
| `version` | เลขรุ่นของแต่ละแถว เพิ่มทีละ 1 ทุกครั้งที่แก้ ใช้คู่กับ `If-Match` | [6](06-key-concepts.md) |
| Optimistic concurrency | ไม่ล็อกข้อมูลตอนเปิดฟอร์ม แต่ตรวจ version ตอนบันทึก ชนแล้วได้ 409 | [6](06-key-concepts.md) |
| "วันนี้" ตามกรุงเทพ | วันที่ปัจจุบันในเขต `Asia/Bangkok` ใช้กับ Last Updated Date | [6](06-key-concepts.md) |
| `DATABASE_URL` / `TEST_DATABASE_URL` | URL ของฐาน dev / ฐาน test ใน `.env` | [3](03-database-prisma.md) |

กลับไป: [สารบัญ](README.md)
