# Prompt `employee-summary-v1`

แหล่งเดียวของ prompt สำหรับรายงาน Workforce Snapshot (PRD §12.5–12.6) — n8n worker ถูกสร้างจากไฟล์ในโฟลเดอร์นี้ (`node workflows/n8n/build.mjs`)

| ไฟล์ | ความหมาย |
| --- | --- |
| `system-prompt.txt` | system prompt ภาษาไทยตาม PRD (คำต่อคำ) |
| `response-schema.json` | structured output schema (`headline` ≤120, `bullets` 3–5 ข้อ ≤240) |
| `settings.json` | model, temperature 0.2, maxOutputTokens 1024, ไม่มี tools/grounding |
| `validate.mjs` | ตรวจโครงสร้าง + ตัวเลขทุกตัวต้องมีใน snapshot + ต้องระบุจำนวนรวม + คำต้องห้าม; map HTTP error → error code ของ worker |
| `fixtures/*.json` | 5 กรณี: seed ปกติ, ไม่มีรายการ, ทุกคน Active, ทุกคน In Active, แผนกที่มี 0 คน (ไม่มีข้อมูลบุคคลจริง) |
| `evaluate.mjs` | รัน 5 fixtures ผ่าน Gemini API ด้วย prompt/schema/validator เดียวกับ worker → `results/` |
| `ai-studio.md` | ขั้นตอนและผลการทดลองใน Google AI Studio |

```bash
node --test prompts/employee-summary-v1/validate.test.mjs
```

```bash
GEMINI_API_KEY=<your key> node prompts/employee-summary-v1/evaluate.mjs
```

ข้อจำกัด: validator พิสูจน์ได้ว่าโครงสร้างถูกและไม่มีตัวเลขที่ไม่มีใน snapshot แต่ไม่พิสูจน์ว่าภาษาไทยสื่อความถูกทุกประโยค — ต้องอ่านผลใน `results/` และ AI Studio ประกอบ ตัวเลขในหน้ารายงานมาจาก DB เสมอ
