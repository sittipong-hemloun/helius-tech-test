# Open WebUI evidence

สถานะ: **BLOCKED** — ต้องใช้ Gemini API key ของผู้สมัคร และสร้างบัญชี admin ของ Open WebUI เอง

สิ่งที่เตรียมและตรวจแล้ว:

- Compose profile `ai-workspace`: `ghcr.io/open-webui/open-webui:v0.11.4`, bind `127.0.0.1:3002`, volume `open_webui_data` แยก, ปิด Ollama/web search/code execution/community sharing/telemetry
- Provider: OpenAI-compatible `https://generativelanguage.googleapis.com/v1beta/openai` + `OPENAI_API_KEY=${GEMINI_API_KEY}`, model เริ่มต้น `${GEMINI_MODEL}`
- ไม่มี RAG/tools/database access; ใช้เฉพาะ snapshot ตัวเลขรวม (`prompts/employee-summary-v1/fixtures/01-seed.json`)

บันทึกหลังทดลอง (กรอก):

| วันที่ | Open WebUI version | Model | Prompt | คำตอบ (ย่อ) | ตรวจตัวเลข |
| --- | --- | --- | --- | --- | --- |
| | v0.11.4 | | system prompt v1 + snapshot 01-seed | | |
