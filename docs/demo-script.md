# Demo script — 15 นาทีรวม Q&A

## เตรียมก่อนวันสัมภาษณ์ (PRD §18.1)

1. `pnpm install` และ `pnpm staging:up` ให้ images build เสร็จล่วงหน้า (ไม่ดาวน์โหลดใหญ่ระหว่าง demo)
2. เปิด :3000 และ :3100 ให้หน้า Employees โหลดได้
3. `pnpm staging:smoke` → ทุกข้อ ✔; `node scripts/staging.mjs reset --confirm-reset` ให้กลับเป็น 5 records
4. เปิด Jenkins build ล่าสุดที่ผ่าน + `docs/performance.md` ไว้ในแท็บ (ไม่รัน load test ระหว่าง demo)
5. เปิด repo ใน editor + AI coding assistant ให้พร้อม

## ลำดับนำเสนอ

| เวลา | สิ่งที่ทำ | พูดถึง |
| --- | --- | --- |
| 0–1 | หน้า Employees :3100 | โจทย์ = Excel 5 แถว + 7 ฟิลด์ / ส่วนที่เพิ่มคือ CI/CD, tests และ performance (Login และ AI report ตัดออกเพื่อความเรียบง่าย) |
| 1–5 | Employees | ข้อมูลตรง Excel (Bob Brown = In Active, วันที่เดิม), ค้น `john`, Engineering + In Active → Bob, Clear → 5, Add **Dana Lee** (engineering, 62000, 2026-09-01) → ID 106 + วันนี้, Edit salary 63000 + uncheck Active → 63,000.00 / In Active / version 2, เปิดสองแท็บแก้ record เดียวกัน → แท็บเก่าได้ conflict, ลบ Dana → กลับเป็น 5 |
| 5–7 | เปิดโค้ด | Next (UI) / Nest (API) / Postgres, `employee-rules.ts` (decimal string, date-only, `In Active` → false), `employees.service.ts` (If-Match, no-op) |
| 7–9 | AI workflow | `docs/ai-usage.md` (วิธีสั่งงาน AI และปัญหาจริงที่ AI ทำพลาดและวิธีจับ) |
| 9–11 | Jenkins + performance | stages, image tag = SHA, staging smoke/rollback; baseline vs index (EXPLAIN ก่อน–หลัง, ข้อเสีย write cost) |
| 11–15 | Q&A | เปิดโค้ดตามคำถาม |

## Script CRUD (ผลที่ต้องเห็น)

| ขั้น | ผลที่คาด |
| --- | --- |
| fresh seed | 5 records, 7 ฟิลด์, Bob Brown In Active |
| ค้น `john` | John Doe |
| Engineering + In Active | Bob Brown |
| สร้าง Dana Lee | ID 106 (fresh fixture), Last updated = วันนี้ |
| แก้ Salary 63000.00 + Status ไม่ติ๊ก | 63,000.00 / In Active / version 2 |
| สองแท็บแก้ record เดียว | แท็บเก่า: "This employee was changed by another user. Reload the latest version." |
| ลบ Dana Lee | เหลือ 5 records; ID ถัดไปไม่ย้อนเป็น 106 (ถ้าอยากได้ 106 อีกให้ reset) |

## เมื่อมีปัญหาหน้างาน

| ปัญหา | ทำอย่างไร |
| --- | --- |
| เน็ตใช้ไม่ได้ | ทุกอย่างรันในเครื่อง 100% เดโมได้ตามปกติ |
| Jenkins ไม่ขึ้น | อธิบาย stages จาก `Jenkinsfile` แล้ว deploy ด้วย `pnpm staging:up` (สคริปต์เดียวกับที่ Jenkins เรียก) |
| DB ไม่พร้อม | `pnpm run doctor`, `docker compose ps`; reset demo เฉพาะเมื่อจำเป็นและบอกว่า reset |
| เวลาน้อย | P0 ก่อน (CRUD + search/filter) แล้วหลักฐาน 1–2 จุด |

## ซ้อม Live Coding (PRD §18.5)

แต่ละโจทย์: อ่านโจทย์ → ระบุ contract ที่เปลี่ยน → prompt AI → ดู diff → รัน test เฉพาะจุด → demo

1. **Filter Join Date ช่วงเริ่ม/จบ** — `employee-query.ts` เพิ่ม `joinDateFrom/To` rule (ใช้ `joinDateRule`) → `ListEmployeesQueryDto` → `EmployeesService.list` เพิ่มเงื่อนไข `e.join_date >= $from::date` → `list-params.ts` + `employee-filters.tsx` เพิ่ม `<input type="date">` สองช่อง → test ใน `employees.test.ts`
2. **Validation เพิ่มหนึ่งข้อ** (เช่น Join Date ห้ามเกินวันนี้ + 1 ปี) — แก้ `joinDateRule` + `employeeSchema` ฝั่งเว็บ + unit test + ข้อความ error ใต้ช่อง

คำถามที่ควรตอบได้: ทำไมแยก Next/Nest, ทำไมเงินเป็น decimal string, Google Login ต่างจากสิทธิ์อย่างไร, ทำไม seed ไม่ stamp วันที่ใหม่, ป้องกัน lost update อย่างไร, ใช้หลักฐานอะไรตัดสินใจเพิ่ม index, AI ทำอะไรผิดจริงบ้าง (ดู `docs/ai-usage.md`)
