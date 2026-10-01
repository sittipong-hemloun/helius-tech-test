# Local staging evidence

## Deploy `c0e9d918585d` — 1 Oct 2026 (UTC ~15:50)

`pnpm staging:up` บน commit `c0e9d91` (working tree สะอาด → tag ไม่มี `-dirty`)

1. Build `employee-console/api:c0e9d918585d` และ `employee-console/web:c0e9d918585d` (multi-stage, ไม่มี `.env` ใน image, web build ด้วย `API_INTERNAL_URL=http://api:3001`)
2. postgres (volume `employee-console-staging_pgdata_staging`) healthy → ยังไม่มี schema จึงไม่มี backup รอบแรก
3. `prisma migrate deploy` → `Applying migration 20261001000000_init` → "All migrations have been successfully applied."
4. First bootstrap: `database marked as demo` → `seed: +4 departments, +5 employees; now 5 employees (4 Active / 1 In Active), 4 departments, salary sum 290000.00; next ID 106`
5. api healthy → web healthy → `✔ staging running c0e9d918585d at http://localhost:3100`

Smoke (`pnpm staging:smoke` ทำงานซ้ำได้):

```text
✔ liveness: ok
✔ readiness (DB + schema): ready
✔ login page: 200
✔ static assets: 1tcj416vuob71.css
✔ auth enforced on employees API: 401 without session
✔ internal API not exposed via web origin: 404
✔ Google sign-in configuration (presence only): not configured
```

Redeploy ด้วย tag เดิมเพื่อเปลี่ยน env (REPORTS_ENABLED) อีก 2 ครั้งระหว่างทดสอบ n8n — smoke ✔ ทุกครั้ง; รอบที่มี schema แล้วสร้าง backup ใน `.backups/` ก่อน migrate

## หมายเหตุ

- Google sign-in บน staging ยัง "not configured" — Login จริงต้องใช้ credentials ของผู้สมัคร (BLOCKED)
- Rollback exercise และ deploy จาก Jenkins: ดูหัวข้อถัดไป (เพิ่มหลังรัน)
