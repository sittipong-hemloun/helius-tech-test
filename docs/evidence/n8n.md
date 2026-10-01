# n8n live run — 1 Oct 2026 (UTC 15:55–15:57)

สภาพแวดล้อม: n8n `2.41.5` (Docker, profile automation) → API staging image `c0e9d918585d` ผ่าน Docker network (`http://api-staging:3001/internal/v1`), PostgreSQL staging

## ขั้นตอนที่รันจริง

1. `REPORTS_ENABLED=true` ใน `.env.staging` ชั่วคราว → `node scripts/staging.mjs up --tag=c0e9d918585d` (smoke ✔ 7/7)
2. `GEMINI_API_KEY=invalid-key-for-live-error-path-test node scripts/ai-up.mjs --no-webui --activate`
   - `Successfully imported 3 credentials` (worker/scheduler bearer จาก `.env.staging`, Gemini key)
   - `Successfully imported 2 workflows`, publish ทั้งสอง, restart n8n
3. Worker heartbeat ปรากฏใน `integration_state.last_worker_seen_at` ภายใน 15 วินาที
4. `n8n execute --id=ecReportDaily001` (ผ่าน trigger "Run on demand") → `POST /internal/v1/reports/scheduled` → 202

## ผล

| เคส | สิ่งที่เกิดใน DB staging | ตรวจอะไร |
| --- | --- | --- |
| Snapshot 5 คน + Gemini key ไม่ถูกต้อง | `SCHEDULED` → `RUNNING` (attempts 1) → `FAILED`, `error_code = PROVIDER_AUTH_ERROR`, ใช้เวลา ~13 วินาที | worker claim จริง, เรียก Gemini API จริง, map 400 `API_KEY_INVALID` เป็น non-retryable, fail callback พร้อม lease, ไม่ retry |
| Snapshot 0 คน (ลบ employees ชั่วคราว) | `SUCCEEDED`, `generated_by = TEMPLATE`, headline "ยังไม่มีข้อมูลพนักงานสำหรับรายงานนี้" | ไม่เรียก Gemini, complete ด้วย model=null |
| Daily รันซ้ำวันเดียวกัน | ไม่ได้รันซ้ำแบบ live (ครั้งที่สองรันหลังลบรายงานแรกเพื่อทดสอบ template) | พฤติกรรมคืนรายงานเดิมพิสูจน์ใน integration test `scheduled reports (AC-46)` |

หลังทดสอบ: `node scripts/staging.mjs reset --confirm-reset` → 5 employees (4/1), salary 290000.00; unpublish workflows; `REPORTS_ENABLED=false` และ redeploy

## ยังไม่ได้ทดสอบ (ต้องใช้ Gemini key จริง)

- เส้นทาง SUCCEEDED ด้วย `generatedBy = GEMINI` (structured output จริง + validator ตัวเลข)
- ขั้นตอน: ใส่ `GEMINI_API_KEY` ใน `.env` → `REPORTS_ENABLED=true` ใน `.env.staging` → `pnpm staging:restart` → `pnpm ai:up --activate` → Generate report
