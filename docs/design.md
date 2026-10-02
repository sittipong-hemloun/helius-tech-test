# UI design notes — Chememan enterprise console (ERP style)

หัวเรื่องของแอปคือทะเบียนพนักงานของ Chememan งานหลักของผู้ใช้คือ "หา ตรวจ และแก้ record ให้ถูก" ซ้ำ ๆ ทั้งวัน จึงออกแบบให้หน้าตาเหมือนโปรแกรม ERP/HR ที่องค์กรใช้จริง: แน่น อ่านเร็ว มีเส้นกริดครบ ไม่ใช่ dashboard สำเร็จรูป ข้อจำกัดจาก PRD: light theme, UI ภาษาอังกฤษ, รองรับ 375–1440 px

สิ่งที่ตั้งใจไม่ใช้ (เพราะทำให้ดูเป็น template/AI): sidebar พร้อมไอคอน, การ์ดมุมโค้งลอยบนพื้นสี, หัวข้อตัวใหญ่แบบกว้าง, badge มีกรอบ, ชิปไอคอนโล่, ป้าย keyboard hint, empty state จัดกึ่งกลาง, ตัวเลขสรุปตัวโต

## Tokens (`apps/web/src/app/globals.css`) — Chememan (CMAN) palette

| Token | Hex | ใช้กับ |
| --- | --- | --- |
| chememan-green (`ledger`) | `#09532d` | แถบเมนูบนสุด, ปุ่มหลัก, ลิงก์ชื่อ, focus ring |
| cman-emerald (`ledger-hover`) | `#00805e` | hover ปุ่มหลัก, จุดทึบของสถานะ Active |
| cman-navy (`navy`) | `#1b3564` | แถวรวมยอด (All employees) ในรายงาน |
| ground | `#f3f7f5` | พื้นหลังหน้า |
| sheet | `#ffffff` | แถบหัวหน้า ตาราง ฟอร์ม dialog |
| head | `#e6ece5` | หัวตาราง, ช่อง label ของ property sheet, footer ของ dialog |
| ink / ink-2 / ink-3 | `#1c1c1c` / `#4b5a52` / `#6b7a72` | ตัวอักษรหลัก / รอง / placeholder และไอคอน |
| rule / rule-strong | `#d3dbd2` / `#9aa79e` | เส้นกริดและกรอบ / ขอบ input และเส้นใต้หัวตาราง |
| bar / bar-strong | `#eef5ee` / `#ddecdc` | แถบ green-bar แถวคู่ / hover แถว |
| stamp | `#c21e31` | การลบและ error เท่านั้น |

Radius: control 6 px, sheet/dialog 8 px — ไม่มีปุ่มทรง pill, ไม่มี badge

## Typography

- **IBM Plex Sans Thai** ตระกูลเดียวทั้งไทยและอังกฤษ (มี Latin ในตัว) ให้ชื่อไทยกับ label อังกฤษจังหวะเดียวกัน ลักษณะอุตสาหกรรม/องค์กร
- ขนาดพื้นฐาน 14 px, ตาราง 13 px, หัวหน้า 18 px bold — ไม่มีหัวข้อตัวใหญ่
- ตัวเลขทุกตัวใช้ `tabular-nums lining-nums`

## Layout

- แถบเมนูเขียวเข้มเต็มความกว้าง (brand + แท็บโมดูล + ผู้ใช้/สิทธิ์ + Sign out) แทน sidebar
- แถบหัวหน้าสีขาวใต้เมนู: ลิงก์ย้อนกลับ, ชื่อหน้า, จำนวนรายการ, ปุ่มคำสั่งทางขวา
- ทะเบียนพนักงาน: กรอบเดียว = toolbar filter (label อยู่หน้าช่อง) + ตารางมีเส้นกริดทุกช่อง หัวตารางพื้นทึบ sticky + footer pagination; แถว ~32 px; คำสั่งในแถวเป็นข้อความ Edit | Delete; ลูกศร sort แสดงเฉพาะคอลัมน์ที่เรียงอยู่ (คอลัมน์อื่นแสดงเมื่อ hover/focus)
- รายละเอียดพนักงาน: property sheet (ช่อง label สีเทาเขียว | ค่า) แบบกริด
- ฟอร์ม: ช่องติดกันใช้เส้นร่วมเหมือนแบบฟอร์มกระดาษ (`.form-grid`), error และ hint อยู่ในช่อง, ช่องที่ระบบกำหนดเป็นพื้น ground
- Dialog: แถบชื่อ / เนื้อหา / แถบปุ่มพื้นทึบ
- ชิดขวา: Salary และตัวเลขจำนวน; กึ่งกลาง: Status, Actions; ชิดซ้าย: ชื่อ ข้อความ วันที่
- Status เป็นข้อความธรรมดา + จุดทึบ (Active) / วงกลวง (In Active)

## จุดเด่นจุดเดียว

ตารางทะเบียน: กริดครบทุกช่อง หัวพื้นทึบ แถบ green-bar แถวคู่ ตัวเลขเรียงแนว — ส่วนอื่นเงียบ ไม่มี gradient, ไม่มี card ซ้อนการ์ด, ไม่มี animation ทางเข้า มี motion เฉพาะตอบสนองการกระทำ (toast, dialog, spinner ของ Running)

## Accessibility

- ทุก input มี `<label>`; error แสดงเป็นข้อความ + ไอคอน และ `role="alert"`; focus ช่องแรกที่ผิด
- Status แสดงด้วยข้อความ + จุดทึบ (Active) / วงกลวง (In Active) ไม่ใช้สีอย่างเดียว
- `:focus-visible` outline 2 px สี ledger (บนแถบเขียวเปลี่ยนเป็นสีขาว), ช่องในฟอร์มใช้ outline แบบ inset เพราะช่องติดกัน, มี Skip to content, หัวตารางใช้ `aria-sort`
- `prefers-reduced-motion` ปิด transition
- มือถือ: เมนูย่อเป็นปุ่ม menu, filter ซ้อนแนวตั้ง, ตารางเลื่อนแนวนอนในกรอบของตัวเอง (หน้าไม่ล้น — ตรวจใน Playwright)

## ข้อความ

ปุ่มบอกผลของการกระทำ (Save employee, Delete employee), toast ใช้คำเดียวกับปุ่ม (Employee created / updated / deleted), error บอกวิธีแก้ ไม่ขอโทษ และไม่ใช้ ALL CAPS / eyebrow label
