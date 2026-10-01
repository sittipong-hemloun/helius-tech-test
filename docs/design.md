# UI design notes — "green-bar ledger"

หัวเรื่องของแอปคือทะเบียนพนักงานที่มาจาก spreadsheet งานหลักของผู้ใช้คือ "หา ตรวจ และแก้ record ให้ถูก" จึงยืมภาษาภาพจากเอกสารบุคคล/เงินเดือนแบบกระดาษ: กระดาษ printout แบบ green-bar, ช่องฟอร์มที่มี label พิมพ์อยู่ในกรอบ และเลขทะเบียน (record number) ตัวใหญ่ ข้อจำกัดจาก PRD: light theme, shadcn/ui-style components, UI ภาษาอังกฤษ, รองรับ 375–1440 px

## Tokens (`apps/web/src/app/globals.css`)

| Token | Hex | ใช้กับ |
| --- | --- | --- |
| ground | `#f3f5f1` | พื้นหลังหน้า (เทาอมเขียวอ่อน ไม่ใช่ครีม) |
| sheet | `#ffffff` | ตาราง ฟอร์ม การ์ด |
| ink | `#1b2a22` | ตัวอักษรหลัก (หมึกเขียวเข้มแบบสมุดบัญชี) |
| bar | `#e6f0e3` | แถบ green-bar ของแถวคู่ |
| ledger | `#1d6a49` | ปุ่มหลัก, focus ring, เลข ID ตัวใหญ่ |
| stamp | `#a8321f` | การลบและ error เท่านั้น |

## Typography

- **Archivo** (variable, แกน `wdth` 62–125) ตัวเดียวทั้งระบบ: หัวเรื่องและเลข ID ใช้ `wdth 125` (expanded) น้ำหนัก 800–900, หัวตารางใช้ `wdth 82` (condensed) ให้คอลัมน์แน่นโดยไม่ต้องย่อขนาด, ตัวเลขใช้ `tabular-nums`
- **Anuphan** เป็น fallback สำหรับชื่อและรายงานภาษาไทย

## จุดเด่นจุดเดียว

ตาราง green-bar: แถวคู่เป็นแถบเขียวอ่อนแบบกระดาษ printout ตัวเลขเรียงแนวเดียวกัน (salary ชิดขวา) ส่วนอื่นเงียบ — ไม่มี gradient, ไม่มี card ซ้อนการ์ด, ไม่มี animation ทางเข้า มี motion เฉพาะตอบสนองการกระทำ (toast, dialog, spinner ของ Running)

## Accessibility

- ทุก input มี `<label>`; error แสดงเป็นข้อความ + ไอคอน และ `role="alert"`; focus ช่องแรกที่ผิด
- Status แสดงด้วยข้อความ + จุดทึบ/กลวง ไม่ใช้สีอย่างเดียว
- `:focus-visible` outline 2 px สี ledger, มี Skip to content, หัวตารางใช้ `aria-sort`
- `prefers-reduced-motion` ปิด transition
- มือถือ: filter ซ้อนแนวตั้ง, ตารางเลื่อนแนวนอนในกรอบของตัวเอง (หน้าไม่ล้น — ตรวจใน Playwright)

## ข้อความ

ปุ่มบอกผลของการกระทำ (Save employee, Delete employee, Generate report), toast ใช้คำเดียวกับปุ่ม (Employee created / updated / deleted), error บอกวิธีแก้ ไม่ขอโทษ และไม่ใช้ ALL CAPS / eyebrow label
