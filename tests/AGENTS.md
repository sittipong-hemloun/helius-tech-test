# tests — e2e, API contract, performance

ชุดทดสอบที่ทำงานกับระบบทั้งก้อน ส่วน unit/integration ของ API อยู่ที่ [apps/api/test](../apps/api/AGENTS.md) และของ web อยู่ข้างโค้ดใน `apps/web/src/lib` — ไม่ใช่ที่นี่

| Folder | เครื่องมือ | รันด้วย | ทำอะไร |
| --- | --- | --- | --- |
| `e2e/` | Playwright (workspace package `@employee-console/e2e`) | `pnpm test:e2e` | production build ของ web + API บนฐานทดสอบแยก — CRUD, filter, URL state, วันที่ข้ามโซนเวลา, layout 375/1024/1440 px, keyboard |
| `postman/` | Newman | `pnpm test:postman` | สัญญา API (status, envelope, header, error code) ตรงเข้า API — collection + `test`/`local` environment |
| `performance/k6/` | k6 (รันใน Docker) | `pnpm perf:run --label=<ชื่อ>` | load 10k records; ผลอยู่ใน `performance/results/` (generate, ไม่ commit) — วิธีวัดดู [docs/performance.md](../docs/performance.md) |

## กฎ

- **รันผ่านคำสั่ง root เท่านั้น** อย่ารัน `playwright test`/`newman`/`k6` ตรง ๆ — runner ใน `scripts/` (`test-e2e.mjs`, `test-postman.mjs`, `perf-run.mjs`) build แอป, สร้างฐานชั่วคราวที่ mark เป็น test/performance, เปิดโปรเซสบนพอร์ตเฉพาะ (e2e 3020/3021, postman 3031, perf 3200/3201) แล้วเขียน env ลง `e2e/.runtime/env.json` ที่ spec อ่านต่อ
- **ห้ามชี้ test ไปที่ฐาน dev/staging** — spec เรียก `resetData()` (ใน `e2e/specs/fixtures.ts`) ซึ่งลบข้อมูลแล้ว seed ใหม่ และ `test:reset` ปฏิเสธฐานที่ไม่ใช่ purpose `test`
- ชื่อ test และ request ใน Postman อ้างข้อกำหนดเป็น `AC-xx` (acceptance criteria ใน [docs/prd.md](../docs/prd.md)) — เพิ่ม/แก้ test ให้คงรหัสเดิมเมื่อทดสอบข้อเดียวกัน
- แก้พฤติกรรม API (status, header, error code) → อัปเดต `postman/employee-console.postman_collection.json`; แก้ UI flow/ข้อความ/โครง DOM → อัปเดต spec ใน `e2e/specs/`
- ผลลัพธ์ (`test-results/`, `playwright-report/`, `e2e/.runtime/`, `performance/results/`) ถูก gitignore — อย่า commit
- ตัวเลข benchmark เทียบกันได้เฉพาะเครื่องว่าง และ `perf:seed` ใช้ได้กับ `APP_ENV=performance` เท่านั้น
