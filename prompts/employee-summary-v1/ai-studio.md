# Google AI Studio trial — employee-summary-v1

สถานะ: **NOT RUN** — ต้องใช้บัญชี Google ของผู้สมัครเปิด https://aistudio.google.com (AI ไม่ได้ login แทน)

## ขั้นตอน

1. Create prompt → Chat → Model: `gemini-3.5-flash-lite` (ถ้าไม่มีในบัญชีให้เลือก Flash-Lite รุ่นล่าสุด แล้วบันทึกชื่อจริงด้านล่าง)
2. System instructions: วางข้อความจาก `system-prompt.txt` ทั้งหมด
3. Run settings: Temperature 0.2, Output length 1024, Structured output = On → Edit → วาง `response-schema.json`, ปิด Grounding/Code execution/URL context
4. ข้อความผู้ใช้: วาง `snapshot` (เฉพาะ object `snapshot`) จาก fixture ทีละไฟล์ `01`, `03`, `04`, `05` (fixture `02` ไม่มีพนักงาน — worker ใช้ template โดยไม่เรียกโมเดล; ลองใน AI Studio ได้เพื่อดูพฤติกรรม แต่ผลจริงใช้ template)
5. คัดลอก JSON ที่ได้มาใส่ตารางด้านล่าง แล้วตรวจด้วย:
   ```bash
   node -e "import('./prompts/employee-summary-v1/validate.mjs').then(m=>console.log(m.checkNarrative(JSON.parse(process.argv[1]), JSON.parse(require('fs').readFileSync('prompts/employee-summary-v1/fixtures/01-seed.json','utf8')).snapshot)))" '<output json>'
   ```
6. Get code → เทียบกับ request ที่ worker ส่ง (`geminiRequest()` ใน `validate.mjs`)

## ผล (กรอกหลังทดลอง)

| Fixture | Model ที่ใช้จริง | Output (headline) | Schema | ตัวเลขตรง | ภาษาไทยอ่านรู้เรื่อง | ไม่แต่งข้อมูล | ผล |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01-seed | | | | | | | NOT RUN |
| 02-empty | (template) | ยังไม่มีข้อมูลพนักงานสำหรับรายงานนี้ | ✔ | ✔ | ✔ | ✔ | PASS (template, ไม่เรียกโมเดล) |
| 03-all-active | | | | | | | NOT RUN |
| 04-all-inactive | | | | | | | NOT RUN |
| 05-zero-department | | | | | | | NOT RUN |
