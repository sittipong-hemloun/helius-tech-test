# Automated test runs

รันบน MacBook (Apple Silicon, macOS 26.0.1, 8 CPU / 24 GiB), Node 24.21.0, pnpm 12.8.1, PostgreSQL 17.11 ใน Docker — ผลจริงจาก terminal ไม่ใช่ค่าคาดการณ์

| ชุด | คำสั่ง | ผล | หมายเหตุ |
| --- | --- | --- | --- |
| API unit | `pnpm --filter @employee-console/api run test:unit` | 5 files, 37 tests passed | rules, dates, query, config, policy, retry, narrative, seed mapping |
| Web unit | `pnpm --filter @employee-console/web run test:unit` | 1 file, 7 tests passed | salary/date format, salary input, URL params |
| Prompt validator | `pnpm run test:prompt` | 5 tests passed | numbers-in-snapshot check, error mapping |
| API integration | `pnpm test:api` | 3 files, 85 tests passed | ฐาน `employee_console_test_<run>` สร้าง/ลบเองทุกครั้ง |
| Newman | `pnpm test:postman` | 107 requests, 616 assertions, 0 failed | API ใน APP_ENV=test, session จาก CLI fixture |
| E2E | `pnpm test:e2e` | 20 passed (ก่อนเพิ่ม AC-20 test) | production builds ของ web/API |
| Secret scan | `pnpm secrets:scan` | 225 tracked files, no matches | |
| Lint / typecheck | `pnpm lint`, `pnpm typecheck` | ผ่านทั้ง api/web/api-client | |

ผลรอบสุดท้ายบน commit ที่ส่งมอบ: ดูหัวข้อ "Final run" ด้านล่าง (เพิ่มหลังรันครบ)
