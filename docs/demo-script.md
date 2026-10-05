# Demo script — 15 นาทีรวม Q&A

## เตรียมก่อนวันสัมภาษณ์ (PRD §18.1)

1. `pnpm install`, `pnpm dev:up` แล้ว `pnpm dev` ให้หน้า http://localhost:3000/employees โหลดได้
2. `pnpm db:reset` ให้กลับเป็น 5 records (ID ถัดไป 106)
3. รัน `pnpm test:api` และ `pnpm test:e2e` หนึ่งรอบ ให้มีผลผ่านล่าสุดไว้โชว์
4. เปิด Swagger http://localhost:3000/api/docs ไว้ในอีกแท็บ
5. เปิด repo ใน editor + AI coding assistant ให้พร้อม

## ลำดับนำเสนอ

| เวลา | สิ่งที่ทำ | พูดถึง |
| --- | --- | --- |
| 0–1 | หน้า Employees | โจทย์ = Excel 5 แถว + 7 ฟิลด์; ตั้งใจให้เรียบง่ายตรงโจทย์ (ตัด Login, AI report, CI/CD และ hardening ที่โจทย์ไม่ได้ขอ — D-46, D-52, D-56) |
| 1–6 | Employees | ข้อมูลตรง Excel (Bob Brown = In Active, วันที่เดิม), ค้น `john`, Engineering + In Active → Bob, Clear → 5, Add **Dana Lee** (engineering, 62000, 2026-09-01) → ID 106 + วันนี้, Edit salary 63000 + uncheck Active → 63,000.00 / In Active / version 2, เปิดสองแท็บแก้ record เดียวกัน → แท็บเก่าได้ conflict, ลบ Dana → กลับเป็น 5 |
| 6–9 | เปิดโค้ด | Next (UI) → Nest (API) → Postgres; `employees/` = module · controller · service · dto; `employee.dto.ts` (กฎทุกช่อง), `employees.service.ts` (`toEmployee` แปลงเงิน/วันที่, `updateMany` + version = If-Match) |
| 9–11 | Tests + AI workflow | integration บน Postgres จริง, E2E สองแท็บ conflict; `docs/ai-usage.md` (วิธีสั่งงาน AI และสิ่งที่ AI ทำพลาดแล้ว test จับได้) |
| 11–15 | Q&A | เปิดโค้ดตามคำถาม |

## Script CRUD (ผลที่ต้องเห็น)

| ขั้น | ผลที่คาด |
| --- | --- |
| หลัง `pnpm db:reset` | 5 records, 7 ฟิลด์, Bob Brown In Active |
| ค้น `john` | John Doe |
| Engineering + In Active | Bob Brown |
| สร้าง Dana Lee | ID 106, Last updated = วันนี้ |
| แก้ Salary 63000.00 + Status ไม่ติ๊ก | 63,000.00 / In Active / version 2 |
| สองแท็บแก้ record เดียว | แท็บเก่า: "This employee was changed by another user. Reload the latest version." |
| ลบ Dana Lee | เหลือ 5 records; ID ถัดไปไม่ย้อนเป็น 106 (ถ้าอยากได้ 106 อีกให้ `pnpm db:reset`) |

## เมื่อมีปัญหาหน้างาน

| ปัญหา | ทำอย่างไร |
| --- | --- |
| เน็ตใช้ไม่ได้ | ทุกอย่างรันในเครื่อง 100% |
| DB ไม่พร้อม | เปิด Docker Desktop, `docker compose ps`, `pnpm dev:up` |
| ข้อมูลเพี้ยนจากการลองเล่น | `pnpm db:reset` แล้วบอกว่า reset |
| เวลาน้อย | CRUD + search/filter ก่อน แล้วโชว์โค้ด 1–2 จุด |

## ซ้อม Live Coding (PRD §18.5)

แต่ละโจทย์: อ่านโจทย์ → ระบุ contract ที่เปลี่ยน → prompt AI → ดู diff → รัน test เฉพาะจุด → demo

1. **Filter Join Date ช่วงเริ่ม/จบ** — `ListEmployeesQuery` เพิ่ม `joinDateFrom`/`joinDateTo` (`@IsOptional() @IsISO8601({ strict: true })`) → `EmployeesService.list` เพิ่ม `joinDate: { gte, lte }` (แปลงด้วย `fromDateOnly`) → `list-params.ts` + `employee-filters.tsx` เพิ่ม `<input type="date">` สองช่อง → test ใน `employees.test.ts`
2. **Validation เพิ่มหนึ่งข้อ** (เช่น Join Date ห้ามเกินวันนี้ + 1 ปี) — เพิ่ม decorator ใน `CreateEmployeeDto` + `employeeSchema` ฝั่งเว็บ + unit test ใน `employee-dto.test.ts`
3. **เพิ่มฟิลด์ใหม่** (เช่น Email) — migration ใหม่ + `schema.prisma` → DTO → `toEmployee()` → `lib/api.ts` ชนิดข้อมูล → form/table → test

คำถามที่ควรตอบได้: ทำไมแยก Next/Nest, ทำไมเงินเป็น decimal string, ป้องกัน lost update อย่างไร (If-Match/version), ทำไมตัดของออก (D-46, D-52, D-56), ทำไม seed ไม่ stamp วันที่ใหม่, AI ทำอะไรผิดจริงบ้าง (ดู `docs/ai-usage.md`)
