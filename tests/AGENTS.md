# tests — e2e

ชุดทดสอบที่ทำงานกับระบบทั้งก้อน ส่วน unit/integration ของ API อยู่ที่ [apps/api/test](../apps/api/AGENTS.md) และของ web อยู่ข้างโค้ดใน `apps/web/src/lib` — ไม่ใช่ที่นี่

| Folder | เครื่องมือ | รันด้วย | ทำอะไร |
| --- | --- | --- | --- |
| `e2e/` | Playwright (workspace package `@employee-console/e2e`) | `pnpm test:e2e` | production build ของ web + API บนฐานทดสอบ — CRUD, filter, URL state, conflict สองแท็บ, วันที่ข้ามโซนเวลา, layout 375 px, keyboard |

## กฎ

- **รันผ่าน `pnpm test:e2e` เท่านั้น** อย่ารัน `playwright test` ตรง ๆ — `e2e/run.mjs` migrate ฐาน `TEST_DATABASE_URL`, build API + web (web ฝัง `API_INTERNAL_URL` ตอน build), เปิด API :3021 และ web :3020 บนฐานทดสอบ แล้วจึงรัน Playwright (ส่ง argument ต่อได้ เช่น `pnpm test:e2e --grep "seed data"`)
- **ห้ามชี้ test ไปที่ฐาน dev** — `resetData()` (ใน `e2e/specs/fixtures.ts`) รัน `db:reset` กับ `TEST_DATABASE_URL` ซึ่งลบข้อมูลแล้ว seed ใหม่ และจะ throw ถ้าไม่ได้รันผ่าน runner
- ชื่อ test อ้างข้อกำหนดเป็น `AC-xx` (acceptance criteria ใน [docs/prd.md](../docs/prd.md)) — เพิ่ม/แก้ test ให้คงรหัสเดิมเมื่อทดสอบข้อเดียวกัน
- แก้ UI flow/ข้อความ/โครง DOM → อัปเดต spec ใน `e2e/specs/`
- test screenshot 375/1024/1440 px ข้ามไว้ จนกว่าจะตั้ง `E2E_SCREENSHOT_DIR=<folder>`
- ผลลัพธ์ (`test-results/`, `playwright-report/`) ถูก gitignore — อย่า commit
