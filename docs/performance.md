# Performance (PRD §15)

> ผลด้านล่างวัดก่อนตัดระบบ Login และ AI reports ออก (แถว report enqueue ถูกลบแล้ว); ตัวเลข employees ยังใช้อ้างอิงได้เพราะ query ไม่เปลี่ยน
>
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
| Load | k6 `grafana/k6:2.3.0` ใน Docker → API ตรง (`host.docker.internal:3201`) ; warmup 30 s + steady 3 นาที |
| Read scenario | 20 VUs: list (page สุ่ม 1–25), Department+Status filter เรียงชื่อ, detail, name search (≥3 ตัวอักษร) |
| Write scenario | 10 VUs: create → PATCH (If-Match) → DELETE |
| Frontend | Lighthouse 13.5 desktop preset, production build, `/employees`, median 3 runs |
| Repeat | 3 รอบต่อ phase, เงื่อนไขเดียวกัน; หยุด Jenkins ก่อนวัด |

## Targets

| Metric | Target |
| --- | --- |
| API list/filter/detail p95 | ≤ 300 ms ที่ 20 VUs บน 10k records |
| Name contains search p95 | ≤ 500 ms ที่ 20 VUs |
| Create/update/delete p95 | ≤ 500 ms ที่ 10 VUs |
| Unexpected error rate | < 1 % |
| Listing payload (20 records) | ≤ 100 KB |
| Lighthouse | Performance ≥ 90, Accessibility ≥ 95 (median 3) |
| CLS | ≤ 0.1 (lab) |

## ผลการวัด (1 ต.ค. 2026, raw: `tests/performance/results/<label>/`)

**สรุป:** ทุก target ผ่านทั้งก่อนและหลังปรับ — ที่ 10,000 records ระบบไม่มีคอขวดจริง เวลาส่วนใหญ่อยู่ที่ Node/Prisma/HTTP ไม่ใช่ DB

| Metric (median p95 ของ 3 runs) | Target | A. Baseline (same build) | B. Optimized |
| --- | --- | --- | --- |
| list | ≤ 300 ms | 60.7 ms | 43.8 ms |
| filter (Department+Status, เรียงชื่อ) | ≤ 300 ms | 63.9 ms | 45.7 ms |
| detail (control — plan ไม่เปลี่ยน) | ≤ 300 ms | 43.4 ms | 31.2 ms |
| search (`searchwell`, `arin`, …) | ≤ 500 ms | 75.6 ms | 46.0 ms |
| create / update / delete | ≤ 500 ms | 34.2 / 28.1 / 16.4 ms | 29.1 / 24.5 / 14.0 ms |
| unexpected error rate | < 1 % | 0.00 % | 0.00 % |
| list payload (20 records) | ≤ 100 KB | 4,225 bytes | 4,225 bytes |
| Lighthouse Performance / Accessibility | ≥ 90 / ≥ 95 | 100 / 96 | 100 / 96 |
| CLS (lab) | ≤ 0.1 | 0.000 | 0.000 |

### ตีความอย่างระวัง

- **ความแปรปรวนระหว่าง run สูงพอ ๆ กับส่วนต่าง**: ใน A เอง run 1→3 ของ list เปลี่ยน 50.8→64.1 ms และ endpoint *detail* ซึ่ง plan ไม่เปลี่ยนเลยก็ต่างกัน 28 % ระหว่าง A กับ B → ส่วนต่าง p95 ระดับ HTTP ส่วนใหญ่เป็น noise ของเครื่อง (Docker Desktop VM, k6 ในเครื่องเดียวกัน) ไม่ใช่ผลของ index
- **หลักฐานที่เชื่อได้คือ EXPLAIN ANALYZE** (`explain.txt` ของแต่ละ label):

| Query | A (ไม่มี index) | B (มี index) |
| --- | --- | --- |
| filter `department_id='sales' AND is_active=false` + ORDER BY lower(name) | Seq Scan ทิ้ง 9,600 แถว, 0.85 ms | Bitmap Index Scan `employees_department_id_is_active_idx`, 0.38 ms |
| count ของ filter | Seq Scan, 0.55 ms | Bitmap Index Scan, 0.07 ms |
| search page `lower(name) LIKE '%searchwell%'` LIMIT 20 | Seq Scan + top-N sort, 3.16 ms | Index Scan บน PK + filter (สถิติของ expression index ทำให้ประมาณ selectivity ดีขึ้น), 0.40 ms |
| count ของ search | Seq Scan, 3.07 ms | **ยัง Seq Scan**, 2.60 ms — planner ไม่เลือก trigram GIN เพราะตารางเล็ก (130 pages) |

- search เป็น endpoint เดียวที่ดีขึ้นมากกว่า control (detail −28 %, search −39 %) สอดคล้องกับ plan ที่เปลี่ยน
- **ข้อเสียที่วัดได้**: `employees_name_trgm_idx` ใช้ 3.8 MB (pkey 240 kB, department+status 112 kB); write p95 ไม่ต่างเกิน noise ที่ขนาดนี้ (create 34.2 → 29.1 ms) — ต้นทุนการเขียนของ GIN จะชัดขึ้นเมื่อข้อมูลโตกว่านี้
- **การตัดสินใจ**: เก็บ index department+status (เล็ก, ถูกใช้จริง); เก็บ trigram index พร้อมบันทึกว่า "ยังไม่ถูกใช้ใน count ที่ 10k" — คาดว่าจะถูกเลือกเมื่อข้อมูลใหญ่ขึ้น ถ้าข้อมูลจริงเล็กแบบนี้ตลอด สามารถ drop ได้โดยไม่เสีย target (A ผ่านทุกข้ออยู่แล้ว)
- ไม่ได้ปรับ pool, cache หรือโค้ดเพิ่ม เพราะไม่พบคอขวดที่มีหลักฐาน (PRD §15.3 ข้อ 7)

### เงื่อนไขของแต่ละชุด

| ชุด | เวลา (UTC) | build | สภาพเครื่อง |
| --- | --- | --- | --- |
| A `baseline-same-build` | 1 ต.ค. 19:13–19:35 | `7d0a72e` (+ flag `--without-perf-indexes` ใน perf-run) | Jenkins controller idle, staging idle; audit workflow agents (grep/read ไฟล์) ทำงานพร้อมกัน |
| B `optimized` | 1 ต.ค. 16:37–16:59 | `7d0a72e` | Jenkins controller idle, staging idle |
| C `baseline` (เดิม) | 1 ต.ค. 16:15–16:37 | `8ed69ab` + k6 tag change | run 1 ทับ Jenkins image build/JVM boot, run 2–3 ทับ integration tests ~1 นาที — **ไม่ใช้เทียบ** |


### A. Baseline — same build, tuning indexes dropped (`--without-perf-indexes`)

commit `7d0a72e11f72` (+ uncommitted changes), Apple M3 × 8, 24 GiB, Darwin 25.0.0 arm64, Docker VM 8 cpus, 8218251264 bytes, Docker Desktop

| Request | Target p95 | Run 1 p50 / p95 (ms) | Run 2 p50 / p95 (ms) | Run 3 p50 / p95 (ms) | Median p95 | Target met |
| --- | --- | --- | --- | --- | --- | --- |
| list | ≤ 300 | 22.8 / 50.8 | 29.0 / 60.7 | 30.5 / 64.1 | 60.7 | yes |
| filter | ≤ 300 | 25.0 / 53.7 | 31.7 / 63.9 | 33.4 / 69.2 | 63.9 | yes |
| detail | ≤ 300 | 15.5 / 36.5 | 19.6 / 43.4 | 20.7 / 46.0 | 43.4 | yes |
| search | ≤ 500 | 30.1 / 61.4 | 39.2 / 75.6 | 41.0 / 81.0 | 75.6 | yes |
| create | ≤ 500 | 14.2 / 31.2 | 15.4 / 34.2 | 15.5 / 34.8 | 34.2 | yes |
| update | ≤ 500 | 11.6 / 25.8 | 12.5 / 28.1 | 12.7 / 28.7 | 28.1 | yes |
| delete | ≤ 500 | 6.4 / 15.1 | 6.9 / 16.7 | 7.0 / 16.4 | 16.4 | yes |

| Run | Read requests (rps) | Read failed rate | Write requests (rps) | Write failed rate | List payload max (bytes) |
| --- | --- | --- | --- | --- | --- |
| 1 | 159208 (758) | 0.00 % | 158496 (755) | 0.00 % | 4225 |
| 2 | 120476 (574) | 0.00 % | 149157 (710) | 0.00 % | 4225 |
| 3 | 115628 (550) | 0.00 % | 144765 (689) | 0.00 % | 4225 |

| Lighthouse run | Performance | Accessibility | CLS | LCP (ms) | TBT (ms) |
| --- | --- | --- | --- | --- | --- |
| 1 | 100 | 96 | 0.000 | 740 | 0 |
| 2 | 100 | 96 | 0.000 | 650 | 0 |
| 3 | 100 | 96 | 0.000 | 653 | 0 |
| **median** | **100** | **96** | **0.000** | **653** | |

Indexes on `employees`:

- `employees_pkey` (240 kB)

### B. Optimized — migration `20261002000000_perf_indexes`

commit `7d0a72e11f72`, Apple M3 × 8, 24 GiB, Darwin 25.0.0 arm64, Docker VM 8 cpus, 8218251264 bytes, Docker Desktop

| Request | Target p95 | Run 1 p50 / p95 (ms) | Run 2 p50 / p95 (ms) | Run 3 p50 / p95 (ms) | Median p95 | Target met |
| --- | --- | --- | --- | --- | --- | --- |
| list | ≤ 300 | 23.6 / 43.8 | 25.7 / 50.4 | 22.8 / 43.6 | 43.8 | yes |
| filter | ≤ 300 | 24.8 / 45.7 | 26.6 / 51.4 | 24.0 / 45.5 | 45.7 | yes |
| detail | ≤ 300 | 16.1 / 31.2 | 17.2 / 35.4 | 15.6 / 30.6 | 31.2 | yes |
| search | ≤ 500 | 24.6 / 46.0 | 30.6 / 58.2 | 23.1 / 43.9 | 46.0 | yes |
| create | ≤ 500 | 15.0 / 29.1 | 14.9 / 28.5 | 15.3 / 29.7 | 29.1 | yes |
| update | ≤ 500 | 12.3 / 24.5 | 12.2 / 23.7 | 12.5 / 25.1 | 24.5 | yes |
| delete | ≤ 500 | 6.7 / 14.0 | 6.7 / 13.6 | 6.8 / 14.4 | 14.0 | yes |

| Run | Read requests (rps) | Read failed rate | Write requests (rps) | Write failed rate | List payload max (bytes) |
| --- | --- | --- | --- | --- | --- |
| 1 | 167456 (797) | 0.00 % | 158100 (753) | 0.00 % | 4225 |
| 2 | 144936 (690) | 0.00 % | 160002 (762) | 0.00 % | 4225 |
| 3 | 169628 (808) | 0.00 % | 152865 (728) | 0.00 % | 4225 |

| Lighthouse run | Performance | Accessibility | CLS | LCP (ms) | TBT (ms) |
| --- | --- | --- | --- | --- | --- |
| 1 | 100 | 96 | 0.000 | 662 | 0 |
| 2 | 100 | 96 | 0.000 | 653 | 0 |
| 3 | 100 | 96 | 0.000 | 637 | 0 |
| **median** | **100** | **96** | **0.000** | **653** | |

Indexes on `employees`:

- `employees_department_id_is_active_idx` (112 kB)
- `employees_name_trgm_idx` (3840 kB)
- `employees_pkey` (240 kB)

### C. First baseline run (commit `8ed69ab`, before the index migration) — contaminated, kept for transparency

commit `8ed69ab06d17` (+ uncommitted changes), Apple M3 × 8, 24 GiB, Darwin 25.0.0 arm64, Docker VM 8 cpus, 8218251264 bytes, Docker Desktop

| Request | Target p95 | Run 1 p50 / p95 (ms) | Run 2 p50 / p95 (ms) | Run 3 p50 / p95 (ms) | Median p95 | Target met |
| --- | --- | --- | --- | --- | --- | --- |
| list | ≤ 300 | 42.2 / 95.8 | 31.1 / 66.3 | 31.5 / 70.8 | 70.8 | yes |
| filter | ≤ 300 | 46.9 / 103 | 34.2 / 71.9 | 34.5 / 74.9 | 74.9 | yes |
| detail | ≤ 300 | 29.2 / 71.4 | 21.1 / 48.0 | 21.3 / 50.9 | 50.9 | yes |
| search | ≤ 500 | 58.2 / 123 | 42.3 / 83.8 | 42.9 / 89.6 | 89.6 | yes |
| create | ≤ 500 | 17.5 / 49.4 | 15.0 / 29.7 | 12.9 / 23.6 | 29.7 | yes |
| update | ≤ 500 | 14.4 / 40.6 | 12.2 / 24.4 | 10.5 / 19.5 | 24.4 | yes |
| delete | ≤ 500 | 7.9 / 23.7 | 6.7 / 14.3 | 5.8 / 11.3 | 14.3 | yes |

| Run | Read requests (rps) | Read failed rate | Write requests (rps) | Write failed rate | List payload max (bytes) |
| --- | --- | --- | --- | --- | --- |
| 1 | 79912 (380) | 0.00 % | 115566 (550) | 0.00 % | 4225 |
| 2 | 111860 (532) | 0.00 % | 156402 (745) | 0.00 % | 4225 |
| 3 | 110680 (527) | 0.00 % | 185874 (885) | 0.00 % | 4225 |

| Lighthouse run | Performance | Accessibility | CLS | LCP (ms) | TBT (ms) |
| --- | --- | --- | --- | --- | --- |
| 1 | 100 | 96 | 0.014 | 665 | 0 |
| 2 | 100 | 96 | 0.014 | 687 | 0 |
| 3 | 100 | 96 | 0.014 | 645 | 0 |
| **median** | **100** | **96** | **0.014** | **665** | |

Indexes on `employees`:

- `employees_pkey` (240 kB)

