# คู่มือเรียนรู้ Employee Console (ฉบับมือใหม่)

คู่มือชุดนี้เขียนให้คนที่ **ยังไม่เคยเขียน NestJS และไม่รู้จัก OpenAPI หรือ Docker** อ่านแล้วเข้าใจว่าโปรเจกต์นี้ทำงานอย่างไร ทุกบทจะอธิบายด้วยภาพก่อน แล้วค่อยชี้ไปที่ไฟล์จริงในโปรเจกต์ เปิดโค้ดตามไปได้ทันที

> เอกสารเดิมใน `docs/` (architecture, runbook, decisions ฯลฯ) ยังเป็นฉบับอ้างอิงที่ละเอียดที่สุด คู่มือชุดนี้เป็นฉบับอ่านง่ายที่พาไปถึงเอกสารเหล่านั้น ถ้าสองที่พูดไม่ตรงกัน ให้ยึดโค้ดไว้ก่อน

## ลำดับการอ่าน

| # | บท | อ่านจบแล้วจะเข้าใจ |
| --- | --- | --- |
| 1 | [ภาพรวมทั้งระบบ](01-big-picture.md) | ชิ้นส่วนแต่ละตัวคืออะไร คุยกันอย่างไร พร้อมตามรอยการ "แก้เงินเดือน Bob" ตั้งแต่กดปุ่มไปจนถึงฐานข้อมูล |
| 2 | [NestJS สำหรับมือใหม่](02-nestjs.md) | Module, Controller, Service, Dependency Injection, DTO + ValidationPipe และ exception ผ่านโค้ด `employees` ของจริง |
| 3 | [ฐานข้อมูลและ Prisma](03-database-prisma.md) | ตาราง, migration, seed และการแปลงเงิน/วันที่ระหว่าง Prisma กับ API |
| 4 | [OpenAPI และ Swagger UI](04-openapi.md) | หน้าเอกสาร API ที่ `/api/docs` มาจากไหน และ type ของเว็บอยู่ที่ไหน |
| 5 | [Docker](05-docker.md) | Docker ในโปรเจกต์นี้มีแค่ PostgreSQL: image, container, volume, compose |
| 6 | [แนวคิดสำคัญของโปรเจกต์](06-key-concepts.md) | `If-Match`/version, เงินที่เป็น string, วันที่ที่ไม่มีเวลา, รูปแบบ error และสถานะใน URL |
| 7 | [การทดสอบ](07-testing.md) | unit, integration และ E2E ต่างกันอย่างไร |
| 8 | [แผนที่เอกสารใน `docs/`](08-docs-guide.md) | เอกสารแต่ละไฟล์บอกอะไร ควรอ่านตอนไหน |
| 9 | [เตรียมตอบคำถาม](09-qa-prep.md) | คำถามที่น่าจะโดนถามตอนนำเสนอ พร้อมคำตอบที่ชี้ไปที่โค้ด |
| — | [อภิธานศัพท์](glossary.md) | คำศัพท์ทั้งหมดในที่เดียว เปิดดูได้เมื่อสงสัย |

ถ้ามีเวลาน้อย ให้อ่านบท 1 → 2 → 6 ก่อน สามบทนี้ครอบคลุมสิ่งที่คนถามบ่อยที่สุด

## วิธีดูภาพในคู่มือ

ภาพทั้งหมดเขียนด้วย [Mermaid](https://mermaid.js.org/) เป็นข้อความที่โปรแกรมแปลงเป็นแผนภาพให้

- **VS Code / Cursor**: ติดตั้ง extension "Markdown Preview Mermaid Support" แล้วกด `Cmd+Shift+V` ที่ไฟล์ `.md`
- **JetBrains (WebStorm ฯลฯ)**: เปิด Markdown preview แล้วเปิดใช้ Mermaid ใน Settings → Languages & Frameworks → Markdown
- **GitHub / GitLab**: แสดงเป็นภาพให้อัตโนมัติ
- ถ้ายังเห็นเป็นโค้ดอยู่ ให้คัดลอกบล็อก `mermaid` ไปวางที่ <https://mermaid.live>

## สัญลักษณ์ในคู่มือ

- **ลองเอง** — คำสั่งที่รันได้จริงบนเครื่อง (ต้อง `pnpm dev:up` และ `pnpm dev` ไว้ก่อน) แต่ละบล็อกมีคำสั่งเดียว
- **กับดัก** — จุดที่มือใหม่ (และ AI) พลาดบ่อยในโปรเจกต์นี้
- ลิงก์ไปไฟล์โค้ดกดเปิดได้ เช่น [employees.controller.ts](../../apps/api/src/employees/employees.controller.ts)
