# อภิธานศัพท์

เรียงตามหมวด แต่ละคำบอกความหมายสั้น ๆ และบทที่อธิบายละเอียด

## เว็บและ HTTP

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Request / Response | คำขอที่ส่งไป และคำตอบที่ได้กลับ ประกอบด้วย method, path, header, body / status code, header, body | [1](01-big-picture.md) |
| Method | คำกริยาของ HTTP: `GET` อ่าน, `POST` สร้าง, `PATCH` แก้บางส่วน, `DELETE` ลบ | [1](01-big-picture.md) |
| Status code | ตัวเลขสามหลักบอกผล เช่น 200 สำเร็จ, 404 ไม่พบ, 409 ชนกัน | [1](01-big-picture.md) |
| Header | ข้อมูลประกอบ request/response เช่น `Content-Type`, `If-Match`, `ETag` | [1](01-big-picture.md) |
| JSON | รูปแบบข้อมูลที่ส่งไปมา หน้าตาเหมือน object ของ JavaScript | [1](01-big-picture.md) |
| REST | แนวคิดที่มองข้อมูลเป็น resource มี URL ของตัวเอง แล้วใช้ method บอกการกระทำ | [1](01-big-picture.md) |
| Origin | scheme + host + port เช่น `http://localhost:3000` เบราว์เซอร์แยกสิทธิ์ตาม origin | [1](01-big-picture.md) |
| CORS | กลไกที่อนุญาตให้หน้าเว็บเรียก origin อื่น โปรเจกต์นี้ไม่เปิดเพราะใช้ origin เดียว | [1](01-big-picture.md) |
| Rewrite / Proxy | Next.js รับคำขอ `/api/*` แล้วส่งต่อให้ NestJS โดยเบราว์เซอร์ไม่รู้ | [1](01-big-picture.md) |
| ETag | header ที่บอก "รุ่น" ของข้อมูล ในโปรเจกต์นี้คือเลข version เช่น `"2"` | [7](07-key-concepts.md) |
| If-Match | header ที่ client ส่ง version ที่ตัวเองเห็นกลับมา เพื่อให้ server ตรวจก่อนแก้ | [7](07-key-concepts.md) |
| Idempotency-Key | UUID ที่ติดกับคำขอสร้าง ส่งซ้ำด้วย key เดิมจะไม่สร้างซ้ำ | [7](07-key-concepts.md) |
| UUID | รหัสสุ่มยาว 128 bit ที่แทบไม่มีทางซ้ำ เช่น `7c9e6679-7425-40de-944b-e07fc1f90ae7` | [7](07-key-concepts.md) |
| Rate limit | จำกัดจำนวนคำขอต่อช่วงเวลา เกินแล้วได้ 429 | [7](07-key-concepts.md) |

## NestJS

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Decorator | ป้าย `@...` ที่แปะบน class/method/property บอก framework ว่าโค้ดนั้นคืออะไร | [2](02-nestjs.md) |
| Module | กล่องที่รวม controller และ provider ของเรื่องเดียวกัน | [2](02-nestjs.md) |
| Controller | class ที่รับ HTTP request แกะข้อมูล แล้วเรียก service | [2](02-nestjs.md) |
| Provider / Service | class ที่ Nest สร้างแล้วแจกจ่ายผ่าน DI; service คือที่อยู่ของกฎธุรกิจ | [2](02-nestjs.md) |
| Dependency Injection (DI) | ขอของที่ต้องใช้ผ่าน constructor แล้ว Nest สร้างและส่งให้ | [2](02-nestjs.md) |
| Token | "ชื่อ" ที่ใช้ขอของจาก DI เช่น `APP_CONFIG` | [2](02-nestjs.md) |
| `@Global()` | module ที่ทุก module ใช้ของได้โดยไม่ต้อง import | [2](02-nestjs.md) |
| Dynamic module | module ที่รับค่าตอนสร้าง เช่น `AppModule.register(config, clock, logger)` | [2](02-nestjs.md) |
| Middleware | ฟังก์ชันที่ทำกับทุก request ก่อนเข้า Nest เช่น ใส่ request ID | [2](02-nestjs.md) |
| Guard | ตัดสินว่า request ผ่านได้ไหม เช่น `RateLimitGuard` | [2](02-nestjs.md) |
| Pipe | ตรวจและแปลงข้อมูลก่อนถึง controller เช่น `ValidationPipe` | [2](02-nestjs.md) |
| Interceptor | ทำงานรอบ ๆ handler ห่อผลลัพธ์ เช่น `EnvelopeInterceptor` | [2](02-nestjs.md) |
| Exception Filter | แปลง error เป็น response มาตรฐาน เช่น `HttpExceptionFilter` | [2](02-nestjs.md) |
| DTO | class ที่นิยามหน้าตาของ body/query เช่น `CreateEmployeeDto` | [2](02-nestjs.md) |
| `@Rule()` | decorator ของโปรเจกต์ ผูก pure function ที่ตรวจฟิลด์เข้ากับ DTO | [2](02-nestjs.md) |
| Decorator metadata | ข้อมูลชนิดของ constructor ที่ TypeScript ฝังไว้ให้ DI อ่าน esbuild/tsx ไม่สร้างให้ | [2](02-nestjs.md) |
| Envelope | รูปแบบห่อ response: `{ data, meta }` หรือ `{ error }` | [7](07-key-concepts.md) |

## ฐานข้อมูล

| คำ | ความหมาย | บท |
| --- | --- | --- |
| ORM | เครื่องมือที่ให้เขียนโค้ดแทน SQL พร้อม type (โปรเจกต์นี้ใช้ Prisma) | [3](03-database-prisma.md) |
| Schema (`schema.prisma`) | ไฟล์นิยามตารางและคอลัมน์ | [3](03-database-prisma.md) |
| Migration | ไฟล์ SQL ที่เปลี่ยนโครงสร้างฐานข้อมูลทีละขั้น เพิ่มได้อย่างเดียว | [3](03-database-prisma.md) |
| Seed | การใส่ข้อมูลตั้งต้น (5 records จาก Excel) | [3](03-database-prisma.md) |
| Transaction | ชุดคำสั่งที่สำเร็จทั้งหมดหรือไม่เกิดอะไรเลย | [3](03-database-prisma.md) |
| Row lock (`FOR UPDATE`) | ล็อกแถวไว้จนจบ transaction คนอื่นที่จะแก้แถวเดียวกันต้องรอ | [3](03-database-prisma.md) |
| Index | โครงสร้างช่วยค้นหาเร็ว เหมือนสารบัญท้ายหนังสือ | [3](03-database-prisma.md) |
| Trigram index | index ที่ช่วยค้นหาข้อความแบบ "มีคำนี้อยู่ข้างใน" (`LIKE '%...%'`) | [3](03-database-prisma.md) |
| `numeric(12,2)` | ชนิดตัวเลขทศนิยมแม่นยำ 12 หลัก ทศนิยม 2 ตำแหน่ง | [7](07-key-concepts.md) |
| Date-only | วันที่ที่ไม่มีเวลาและ timezone เช่น `2023-01-15` | [7](07-key-concepts.md) |
| Role | ผู้ใช้ของฐานข้อมูล โปรเจกต์แยก app role กับ test role | [3](03-database-prisma.md) |
| SQL injection | การโจมตีด้วยการแทรก SQL ผ่านค่าที่ผู้ใช้ส่งมา ป้องกันด้วย parameter | [3](03-database-prisma.md) |

## OpenAPI

| คำ | ความหมาย | บท |
| --- | --- | --- |
| OpenAPI | มาตรฐานเอกสาร API เป็น JSON/YAML บอก path, parameter, body, response | [4](04-openapi.md) |
| Swagger | ชื่อเดิมของ OpenAPI และชุดเครื่องมือ เช่น Swagger UI | [4](04-openapi.md) |
| Swagger UI | หน้าเว็บที่แสดงเอกสาร API และกดลองยิงได้ (`/api/docs`) | [4](04-openapi.md) |
| Schema (OpenAPI) | นิยามหน้าตาของข้อมูลชนิดหนึ่ง เช่น `EmployeeDto` | [4](04-openapi.md) |
| `openapi-typescript` | เครื่องมือแปลง `openapi.json` เป็น TypeScript type (`schema.d.ts`) | [4](04-openapi.md) |
| Drift | เอกสารหรือ type ที่ commit ไว้ไม่ตรงกับโค้ดปัจจุบัน | [4](04-openapi.md) |

## Docker

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Image | แม่พิมพ์ของแอปที่แพ็กพร้อมรัน แก้ข้างในไม่ได้ | [5](05-docker.md) |
| Container | image ที่กำลังรันอยู่ | [5](05-docker.md) |
| Volume | ที่เก็บข้อมูลถาวรนอก container | [5](05-docker.md) |
| Compose | ไฟล์ YAML ที่บอกว่าจะเปิด container อะไร ต่อกันอย่างไร | [5](05-docker.md) |
| Dockerfile | สูตรสร้าง image | [5](05-docker.md) |
| Multi-stage build | Dockerfile ที่แบ่งช่วง build กับช่วง runtime ให้ image สุดท้ายเล็ก | [5](05-docker.md) |
| Tag | ชื่อรุ่นของ image ในโปรเจกต์นี้คือ commit SHA | [5](05-docker.md) |
| Healthcheck | คำสั่งที่ Docker ใช้ตรวจว่า container พร้อมหรือยัง | [5](05-docker.md) |
| Profile (Compose) | กลุ่ม service ที่เปิดเฉพาะเมื่อระบุ เช่น `ci` สำหรับ Jenkins | [5](05-docker.md) |

## CI/CD และ Jenkins

| คำ | ความหมาย | บท |
| --- | --- | --- |
| CI | ตรวจโค้ดอัตโนมัติทุกครั้งที่มีโค้ดใหม่ | [6](06-jenkins.md) |
| CD | ส่งโค้ดที่ผ่านแล้วขึ้น environment อัตโนมัติ | [6](06-jenkins.md) |
| Pipeline | ชุดขั้นตอน CI/CD ทั้งหมด เขียนใน `Jenkinsfile` | [6](06-jenkins.md) |
| Stage / Step | ด่านหนึ่งใน pipeline / คำสั่งย่อยในด่าน | [6](06-jenkins.md) |
| Controller | ตัวกลางของ Jenkins: หน้าเว็บ, job, ประวัติ | [6](06-jenkins.md) |
| Agent | เครื่องที่รันคำสั่งจริง (`host-agent`) | [6](06-jenkins.md) |
| Build | การรัน pipeline หนึ่งครั้ง | [6](06-jenkins.md) |
| Artifact | ไฟล์ผลลัพธ์ที่เก็บกับ build | [6](06-jenkins.md) |
| Credentials | ความลับที่ Jenkins เก็บแทนการเขียนในโค้ด | [6](06-jenkins.md) |
| JCasC | ตั้งค่า Jenkins ด้วยไฟล์ YAML (`casc.yaml`) | [6](06-jenkins.md) |
| Staging | environment ที่จำลอง production ไว้ทดสอบก่อนใช้จริง (:3100) | [5](05-docker.md) |
| Smoke test | การตรวจเร็ว ๆ หลัง deploy ว่าระบบยังใช้งานได้ | [5](05-docker.md) |
| Rollback | ย้อนกลับไปรุ่นก่อนหน้าเมื่อรุ่นใหม่มีปัญหา | [5](05-docker.md) |
| Manifest | ไฟล์บันทึกว่า staging รัน tag ไหน ก่อนหน้าคืออะไร | [5](05-docker.md) |

## การทดสอบ

| คำ | ความหมาย | บท |
| --- | --- | --- |
| Unit test | ทดสอบฟังก์ชันเล็ก ๆ ไม่ใช้ฐานข้อมูล | [8](08-testing.md) |
| Integration test | ทดสอบ API ทั้งก้อนกับฐานข้อมูลจริง | [8](08-testing.md) |
| Contract test | ทดสอบว่า API ตอบตามสัญญา (status, header, error code) | [8](08-testing.md) |
| E2E test | ทดสอบผ่านเบราว์เซอร์จริงเหมือนผู้ใช้ | [8](08-testing.md) |
| Vitest | ตัวรัน test ของ JavaScript/TypeScript | [8](08-testing.md) |
| Supertest | library ยิง HTTP เข้าแอป Nest ใน test | [8](08-testing.md) |
| Postman / Newman | โปรแกรมยิง API / ตัวรัน collection ของ Postman จาก command line | [8](08-testing.md) |
| Playwright | เครื่องมือควบคุมเบราว์เซอร์สำหรับ E2E | [8](08-testing.md) |
| FakeClock | นาฬิกาปลอมที่ตรึงเวลาไว้ใช้ใน test | [2](02-nestjs.md) |
| AC-xx | รหัส acceptance criteria ใน PRD ที่ชื่อ test อ้างถึง | [8](08-testing.md) |

## เฉพาะโปรเจกต์นี้

| คำ | ความหมาย | บท |
| --- | --- | --- |
| D-xx | รหัสการตัดสินใจใน [decisions.md](../decisions.md) | [9](09-docs-guide.md) |
| PRD §x.y | อ้างถึงหัวข้อใน [prd.md](../prd.md) | [9](09-docs-guide.md) |
| `APP_ENV` | ตัวแปรบอกว่ารันใน environment ไหน (`local`, `staging`, `test`) | [1](01-big-picture.md) |
| `database_purpose` | ป้ายในตาราง `app_meta` บอกว่าฐานนี้ใช้ทำอะไร คำสั่งลบข้อมูลตรวจก่อนทุกครั้ง | [3](03-database-prisma.md) |
| Business date | "วันนี้" ตามเขตเวลา `Asia/Bangkok` ใช้กับ Last Updated Date | [7](07-key-concepts.md) |
| No-op update | กด Save โดยไม่ได้เปลี่ยนค่า ระบบไม่เขียนฐานข้อมูล | [7](07-key-concepts.md) |
| `-dirty` tag | tag ของ image ที่ build ตอนแก้ไฟล์ที่ git track อยู่แต่ยังไม่ commit (ไฟล์ใหม่ที่ยังไม่ add ไม่นับ) | [5](05-docker.md) |

กลับไป: [สารบัญ](README.md)
