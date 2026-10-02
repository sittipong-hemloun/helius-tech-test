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
- สถานะ deploy (manifest + backups) อยู่ที่ `~/.employee-console/staging` ใช้ร่วมกันระหว่าง local และ Jenkins (D-41)

## Deploy จาก Jenkins — 2 ต.ค. 2026

| Build | Tag | ผล |
| --- | --- | --- |
| #4 | `c06f5dfc5873` | migrate ล้ม → `⚠ rolling back to c0e9d918585d (schema left as is; migrations are expand-compatible)` → backup ก่อน rollback → `✔ staging running c0e9d918585d` → smoke ✔ |
| #5 | `a0dbe2f64a76` | backup → migrate (`20261002000000_perf_indexes`) → api/web healthy → smoke 7/7 ✔ |
| #6 | `b1aa0747ec84` | ปรับ role ของ volume เดิม (`ALTER ROLE` — app role `NOCREATEDB`, D-43) → backup → migrate (ไม่มี pending) → smoke 7/7 ✔ |

ตรวจหลัง #6: `pg_roles` ของ staging → `employee_console_app | rolcreatedb = f`; container `employee-console/api:b1aa0747ec84`, `employee-console/web:b1aa0747ec84`

## Rollback exercise (AC-55) — 2 ต.ค. 2026 UTC 00:44–00:45

```text
### pnpm staging:rollback (2026-10-02T00:44:58Z)
• backup written to ~/.employee-console/staging/backups/staging-2026-10-02T00-45-05-949Z-before-c0e9d918585d.sql
No pending migrations to apply.
✔ staging running c0e9d918585d at http://localhost:3100
✔ liveness / readiness (DB + schema) / login page / static assets / 401 without session / internal API 404 / Google config presence
employee-console-staging-api-1 employee-console/api:c0e9d918585d
employee-console-staging-web-1 employee-console/web:c0e9d918585d

### redeploy a0dbe2f64a76 (2026-10-02T00:45:23Z)
• backup written to ~/.employee-console/staging/backups/staging-2026-10-02T00-45-23-521Z-before-a0dbe2f64a76.sql
No pending migrations to apply.
✔ staging running a0dbe2f64a76 at http://localhost:3100
✔ smoke 7/7
manifest current a0dbe2f64a76 previous c0e9d918585d
```

image ก่อนหน้า (`c0e9d918585d`, schema รุ่น `init`) รันบนฐานที่มี migration `perf_indexes` แล้วได้ เพราะ migration เป็นแบบ expand-compatible (เพิ่ม index อย่างเดียว) — readiness ตรวจเฉพาะ migration ที่ image นั้นต้องใช้ (D-33)
