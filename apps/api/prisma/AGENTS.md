# apps/api/prisma — schema, migrations, seed data

## Migrations

- **append-only**: ห้ามแก้ `migrations/*/migration.sql` ที่ถูก apply ไปแล้ว (dev/staging/CI) — ต้องการเปลี่ยนให้เพิ่ม migration ใหม่ (`YYYYMMDDHHMMSS_<ชื่อ>`) และห้ามแก้ `migration_lock.toml`
- สิ่งที่ Prisma schema บอกไม่ได้ต้องเขียนเป็น SQL ใน migration และมีคอมเมนต์ใน `schema.prisma` ชี้ไป: identity column, CHECK constraint, partial unique index, trigram GIN index (`employees_name_trgm_idx`) — `prisma migrate dev` สร้าง SQL ให้ได้ไม่ครบ ต้องตรวจและเติมเอง
- **index เพื่อ performance แยก migration ของตัวเอง** และเป็น expand-only (D-32, `20261002…_perf_indexes`) เพื่อให้ rollback image ได้ (ชุด benchmark ถูกตัดแล้ว — D-52 แต่ index ยังอยู่)
- `/health/ready` ตรวจว่า migration **ล่าสุดที่มากับ build** ถูก apply แล้ว (D-33) — เพิ่ม migration = deploy ต้องรัน `prisma migrate deploy` ก่อน API ใหม่ขึ้น (`pnpm staging:up` ทำให้)
- migration `20261003…_remove_login_and_reports` คือการตัดขอบเขต (D-46): ตาราง `users`, `sessions`, `reports`, `integration_state` ไม่มีอีกแล้ว

## `schema.prisma`

- SQL ใช้ `snake_case` (`@map`/`@@map`), API ใช้ camelCase
- แก้แล้วต้อง `prisma generate` (build/typecheck/dev ทำให้เอง) — client ที่ได้อยู่ใน `src/generated/prisma` (ไม่อยู่ใน git)
- Prisma ติดที่ **7.10.0** โดยตั้งใจ (`latest` ชี้ไป RC — D-14) อย่าอัปเกรดเอง

## `seed-data/`

`test-exam-data.xlsx` คือไฟล์ต้นฉบับจากโจทย์ (5 records, ID 101–105) และ `test-exam-data.json` คือสำเนาที่ seed อ่าน — แก้ได้เฉพาะเมื่อโจทย์เปลี่ยน แล้วต้องคง unit test `test/unit/seed-mapping.test.ts` ให้ผ่าน seed เติมเฉพาะ ID ที่ขาด ไม่ทับข้อมูลที่มี (D-02)
