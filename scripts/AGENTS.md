# scripts — task runner ของ repo

Node ESM (`.mjs`) ไม่มี build step และไม่ใช้ TypeScript เรียกจาก `scripts` ใน `package.json` ของ root (ยกเว้น `staging.mjs reset|restore` ที่เรียกตรง) ใช้ได้เฉพาะ built-in ของ Node กับ devDependencies ของ root (`pg`, `newman`) — ถ้าต้องใช้แพ็กเกจอื่นให้เพิ่มที่ root `package.json`

| กลุ่ม | ไฟล์ | หน้าที่ |
| --- | --- | --- |
| เครื่อง dev | `setup.mjs`, `doctor.mjs`, `dev-up.mjs`, `down.mjs` | ตรวจเครื่อง/สร้าง `.env`, วินิจฉัย, เปิด DB + migrate + seed, หยุด container |
| staging | `staging.mjs` | build image ตาม SHA → backup → migrate → deploy → smoke; `rollback`, `reset`, `restore` |
| CI | `ci-up.mjs`, `ci-db.mjs`, `secret-scan.mjs` | เปิด Jenkins, ฐานของ build นั้น, ตรวจ secret ใน tracked files |
| test | `test-e2e.mjs`, `test-postman.mjs` | runner ของชุดใน [tests/](../tests/AGENTS.md) |
| `lib/` | `sh.mjs`, `env.mjs`, `db.mjs`, `test-env.mjs` | `ROOT`/`run`/`waitFor`/log helper; อ่าน-เขียน `.env` โดยคงคอมเมนต์; ตรวจสถานะ DB/migration; ฐานทดสอบชั่วคราว (`freshDatabase`/`dropDatabase`) + เปิดโปรเซส API |

## กฎ

- **ห้ามพิมพ์ค่า secret** (รหัสผ่าน, `DATABASE_URL`, token) ลงจอ/log/ไฟล์ — เปรียบเทียบค่าได้แต่ไม่แสดง (`setup`, `doctor`, `secret-scan` ทำแบบนี้); `setup` ไม่เขียนทับค่าที่ผู้ใช้ตั้งไว้แล้ว
- คำสั่งที่ลบ/เขียนทับข้อมูลต้องมี flag ยืนยันชัดเจน (`--confirm-reset`, `--confirm-restore`) และตรวจ `APP_ENV` + เครื่องหมาย purpose ของฐาน (demo/test) ก่อนทำ — อย่าเพิ่มทางลัดที่ข้ามการตรวจ
- ทดสอบต้องใช้ฐานชั่วคราว (`lib/test-env.mjs` → `freshDatabase`/`dropDatabase`) ด้วย role `TEST_DB_*` ห้ามชี้ไปฐาน dev/staging
- staging เก็บ manifest/backup ที่ `~/.employee-console/staging` (`STAGING_STATE_DIR`, D-41) เพื่อให้เครื่องคุณกับ Jenkins เห็นประวัติ deploy เดียวกัน
- เพิ่ม script ใหม่ → ลงทะเบียนใน `package.json` ของ root และเพิ่มแถวในตาราง "คำสั่งทั้งหมด" ของ [README.md](../README.md); ชื่อ `setup`/`doctor` ชนกับ built-in ของ pnpm จึงต้องเรียกด้วย `pnpm run` (D-34)
- `infra/jenkins/agent.mjs` import `lib/env.mjs` จากที่นี่ — เปลี่ยน signature แล้วต้องตรวจตัวเรียกนั้นด้วย
