# apps/api/prisma — schema, migrations, seed data

## Migrations

- **append-only**: ห้ามแก้ `migrations/*/migration.sql` ที่ถูก apply ไปแล้ว — ต้องการเปลี่ยนให้เพิ่ม migration ใหม่ (`YYYYMMDDHHMMSS_<ชื่อ>`) และห้ามแก้ `migration_lock.toml`
- สิ่งที่ Prisma schema บอกไม่ได้ต้องเขียนเป็น SQL ใน migration และมีคอมเมนต์ใน `schema.prisma` ชี้ไป: identity column, CHECK constraint, trigram GIN index (`employees_name_trgm_idx`) — `prisma migrate dev` สร้าง SQL ให้ได้ไม่ครบ ต้องตรวจและเติมเอง
- ประวัติการตัดขอบเขต: `20261003…_remove_login_and_reports` (D-46) ลบ `users`, `sessions`, `reports`, `integration_state`; `20261005…_simplify` (D-56) ลบ `idempotency_keys`, `app_meta` — เหลือ `departments` และ `employees`
- apply ด้วย `pnpm db:migrate` (`prisma migrate deploy`); test สร้างฐาน `employee_console_test` และ migrate เอง

## `schema.prisma`

- SQL ใช้ `snake_case` (`@map`/`@@map`), API ใช้ camelCase
- แก้แล้วต้อง `prisma generate` (build/typecheck/dev ทำให้เอง) — client ที่ได้อยู่ใน `src/generated/prisma` (ไม่อยู่ใน git)
- Prisma ติดที่ **7.10.0** โดยตั้งใจ (`latest` ชี้ไป RC — D-14) อย่าอัปเกรดเอง

## `seed-data/`

`test-exam-data.xlsx` คือไฟล์ต้นฉบับจากโจทย์ (5 records, ID 101–105) และ `test-exam-data.json` คือสำเนาที่ seed อ่าน — แก้ได้เฉพาะเมื่อโจทย์เปลี่ยน แล้วต้องคง unit test `test/unit/seed.test.ts` ให้ผ่าน seed ใส่ข้อมูลเฉพาะเมื่อตาราง employees ว่าง ไม่ทับข้อมูลที่มี (D-56)
