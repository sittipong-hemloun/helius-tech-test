# Automated test runs

รันบน MacBook (Apple Silicon, macOS 26.0.1, 8 CPU / 24 GiB), Node 24.21.0, pnpm 12.8.1, PostgreSQL 17.11 ใน Docker — ผลจริงจาก terminal ไม่ใช่ค่าคาดการณ์

| ชุด | คำสั่ง | ผล | หมายเหตุ |
| --- | --- | --- | --- |
| API unit | `pnpm --filter @employee-console/api run test:unit` | 5 files, 40 tests passed | rules, dates, query, config, policy, retry, narrative, seed mapping |
| Web unit | `pnpm --filter @employee-console/web run test:unit` | 1 file, 7 tests passed | salary/date format, salary input, URL params |
| Prompt validator | `pnpm run test:prompt` | 5 tests passed | numbers-in-snapshot check, error mapping |
| API integration | `pnpm test:api` | 4 files, 88 tests passed | ฐาน `employee_console_test_<run>` สร้าง/ลบเองทุกครั้งด้วย test role (D-43) |
| Newman | `pnpm test:postman` | 107 requests, 616 assertions, 0 failed | API ใน APP_ENV=test, session จาก CLI fixture |
| E2E | `pnpm test:e2e` | 22 passed, 1 skipped | production builds ของ web/API; test ที่ skip คือการถ่าย screenshot (รันเมื่อตั้ง `E2E_SCREENSHOT_DIR`, ผลอยู่ใน `screenshots/`) |
| Secret scan | `pnpm secrets:scan` | 299 tracked files, no matches | ค่าใน `.env`/`.env.staging` + pattern |
| Lint / typecheck | `pnpm lint`, `pnpm typecheck` | ผ่านทั้ง api/web/api-client | |
| Doctor | `pnpm run doctor` | database: migrations ล่าสุด, app role `NOCREATEDB`, test role password set | |
| Perf connectivity | `pnpm perf:run --runs=1 --steady=15s --warmup=5s --skip-build --no-lighthouse` | read 21,484 req (p95 34.95 ms), write 20,094 req (p95 18.37 ms), enqueue 30 req, `http_req_failed` 0 ทุก scenario | ตรวจว่า k6 ใน Docker เข้าถึง API ที่ฟัง `127.0.0.1` ได้ (D-45) — รอบสั้น ไม่ใช่ benchmark จึงไม่ได้เก็บผล; benchmark จริงอยู่ใน `docs/performance.md` |

## Final run

| ที่ไหน | Commit | ผล |
| --- | --- | --- |
| เครื่องพัฒนา | `bdde0fb` | ทุกแถวในตารางด้านบน (2 ต.ค. 2026) |
| Jenkins #6 | `b1aa074` (= `bdde0fb` + แก้ JCasC/`ci:up` เท่านั้น) | ผ่านทุก stage รวม deploy staging + smoke — `jenkins/build-6.log` |

commit หลังจากนี้แก้เฉพาะเอกสาร/หลักฐาน (ไม่มีโค้ดเปลี่ยน)
