# Performance (PRD §15)

> Targets ในตารางนี้คือ **acceptance targets ของ PRD** ไม่ใช่ SLA และไม่ใช่ผลที่วัดได้ ผลจริงอยู่ในหัวข้อ "ผลการวัด" พร้อมไฟล์ raw ใน `tests/performance/results/`

## วิธีวัด

```bash
pnpm perf:run --label=baseline
```

| รายการ | ค่า |
| --- | --- |
| Dataset | 10,000 synthetic employees, generator `apps/api/scripts/perf-seed.ts` (mulberry32 seed 42), แผนก 40/25/20/15 %, Active 80 % ทุกแผนก, กลุ่มค้นหา `searchwell` 200 records, checksum ใน `tests/performance/seed-manifest.json` |
| Database | `employee_console_perf` (สร้างใหม่ทุกครั้ง, mark `performance`) — ไม่ใช่ฐาน demo |
| API | production build (`node dist/main.js`), 1 instance, pool 10, `APP_ENV=performance`, `PERF_RATE_LIMIT_OVERRIDE=true` (เฉพาะ performance) |
| Load | k6 `grafana/k6:2.3.0` ใน Docker → API ตรง (`host.docker.internal:3201`) ด้วย test-only session; warmup 30 s + steady 3 นาที |
| Read scenario | 20 VUs: list (page สุ่ม 1–25), Department+Status filter เรียงชื่อ, detail, name search (≥3 ตัวอักษร) |
| Write scenario | 10 VUs: create → PATCH (If-Match) → DELETE |
| Report enqueue | POST /reports 10 ครั้ง (worker stub fail งานทันทีเพื่อปล่อยคิว) |
| Frontend | Lighthouse 13.5 desktop preset, production build, `/employees` (Admin), median 3 runs |
| Repeat | 3 รอบต่อ phase, เงื่อนไขเดียวกัน; หยุด Jenkins/n8n/Open WebUI ก่อนวัด |

## Targets

| Metric | Target |
| --- | --- |
| API list/filter/detail p95 | ≤ 300 ms ที่ 20 VUs บน 10k records |
| Name contains search p95 | ≤ 500 ms ที่ 20 VUs |
| Create/update/delete p95 | ≤ 500 ms ที่ 10 VUs |
| Unexpected error rate | < 1 % |
| Manual report enqueue p95 | ≤ 1,000 ms |
| Listing payload (20 records) | ≤ 100 KB |
| Lighthouse | Performance ≥ 90, Accessibility ≥ 95 (median 3) |
| CLS | ≤ 0.1 (lab) |

## ผลการวัด

_กำลังวัด — ตารางนี้จะถูกแทนด้วยผลจริงจาก `tests/performance/results/<label>/summary.json`_
