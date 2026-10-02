# Configuration

ค่าทั้งหมดถูกตรวจตอน API start (`apps/api/src/config/app-config.ts`, zod) — ถ้าผิด process จะหยุดพร้อมรายการปัญหา (ไม่แสดงค่า secret) ค่า timeout/limit ทั้งหมดเป็น typed config ตาม PRD ไม่กระจายเป็น magic number

ไฟล์: `.env` (dev) และ `.env.staging` (staging) สร้างโดย `pnpm run setup` จาก `.env.example` / `.env.staging.example` — ทั้งคู่อยู่ใน `.gitignore` ค่า secret ที่ต้องสุ่มจะถูกสร้างให้อัตโนมัติ ค่าภายนอก (Google, Gemini, อีเมล) ต้องกรอกเอง

## API / runtime

| Variable | Default | ความหมาย / กฎที่บังคับ |
| --- | --- | --- |
| `APP_ENV` | `local` | `local` · `staging` · `test` · `performance` — คุม guard ทั้งหมด |
| `NODE_ENV` | `development` | ไม่ใช้แทน APP_ENV |
| `APP_TIMEZONE` | `Asia/Bangkok` | วันธุรกิจของ Last Updated Date และรายงาน |
| `PUBLIC_APP_ORIGIN` | `http://localhost:3000` | origin ของเว็บ (ต้องเป็น origin เท่านั้น); HTTP ได้เฉพาะ loopback, ถ้า HTTPS cookie จะเป็น `Secure` |
| `PORT` / `HOST` | `3001` / `127.0.0.1` | listener ของ NestJS (container ใช้ `0.0.0.0`) |
| `API_INTERNAL_URL` | `http://localhost:3001` | ปลายทาง rewrite `/api/*` ของ Next.js — **ถูกฝังตอน build**; staging image build ด้วย `http://api:3001` |
| `DATABASE_URL` | สร้างโดย setup | connection ของ API/Prisma |
| `DB_POOL_MAX` | `10` | pool ของ Prisma adapter |
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | จำกัด trust proxy ตาม topology (ไม่เปิด `true`) |
| `LOG_LEVEL` | `info` | JSON logs; debug ไม่พิมพ์ body/secret |
| `SESSION_SECRET` | สุ่ม 48 bytes | ≥ 32 ตัวอักษร, ห้ามเป็น placeholder, แยกต่อ environment |
| `SESSION_COOKIE_NAME` | `employee_console.<APP_ENV>.sid` | แยก local/staging เพราะ cookie ไม่แยกตามพอร์ต |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ว่าง | ว่าง → `/api/auth/google` ตอบ 503 `AUTH_NOT_CONFIGURED` |
| `GOOGLE_REDIRECT_URI` | `${PUBLIC_APP_ORIGIN}/api/auth/google/callback` | ต้องอยู่บน PUBLIC_APP_ORIGIN |
| `GOOGLE_ISSUER` | `https://accounts.google.com` | override ได้เฉพาะ `APP_ENV=test` (mock OIDC) |
| `ADMIN_EMAILS` / `VIEWER_EMAILS` | ว่าง | comma-separated, normalize เป็นตัวเล็ก; อีเมลซ้ำกันสองกลุ่ม → start ไม่ได้ |
| `REPORTS_ENABLED` | `false` | `true` ต้องมี `WORKER_SERVICE_TOKEN`; `false` → POST reports ตอบ 503 `AI_NOT_CONFIGURED` |
| `GEMINI_MODEL` | `gemini-3.8-flash` | model ที่ส่งให้ worker ใน job |
| `WORKER_SERVICE_TOKEN` / `SCHEDULER_SERVICE_TOKEN` | สุ่ม | ≥ 32 ตัวอักษร และต้องต่างกัน; ใช้กับ `/internal/v1` เท่านั้น |
| `REPORT_MAINTENANCE_ENABLED` | `true` | loop 30 วินาที (lease หมด/deadline) — test ปิดแล้วเรียกเองด้วย FakeClock |
| `RATE_LIMIT_ENABLED` | `true` | ปิดได้ใน test |
| `AUTH_FIXTURES_ENABLED` | `false` | `true` ได้เฉพาะ test/performance (startup assertion) |
| `PERF_RATE_LIMIT_OVERRIDE` | `false` | `true` ได้เฉพาะ performance |
| `BUILD_COMMIT_SHA` / `APP_VERSION` | `unknown` / `1.0.0` | แสดงใน Integrations; image ตั้งจาก build arg |

ค่าคงที่ตาม PRD ที่อยู่ใน config: idle session 30 นาที, absolute 8 ชั่วโมง, login state 10 นาที, lease 120 วินาที, attempts 3, backoff 30/60 วินาที, deadline 10 นาที, manual report 10/ชั่วโมง, worker ถือว่า unavailable หลัง 60 วินาที, rate limit read 300 / write 60 ต่อนาทีต่อ session, Google start 10/นาที/IP, claim 10/นาที/token, body 32 KB (callback 8 KB), idempotency key 24 ชั่วโมง

## Docker / tools (อยู่ใน `.env`)

| Variable | ใช้โดย |
| --- | --- |
| `POSTGRES_PASSWORD`, `APP_DB_USER`, `APP_DB_PASSWORD`, `POSTGRES_HOST_PORT` | postgres container (role แอปแยกจาก superuser, `NOCREATEDB`) |
| `TEST_DB_USER`, `TEST_DB_PASSWORD` | role แยกสำหรับ integration/E2E/Newman/perf (`CREATEDB`, เป็นเจ้าของเฉพาะ `employee_console_test_*` และ `employee_console_perf`) — setup สร้างรหัสให้, `pnpm dev:up` ปรับ role ของ volume เดิมให้ตรง |
| `N8N_DB_PASSWORD`, `N8N_ENCRYPTION_KEY`, `N8N_INTERNAL_API_URL` | n8n (DB role แยก, ห้ามเปลี่ยน encryption key หลังสร้าง credentials) |
| `GEMINI_API_KEY` | นำเข้า n8n credential และ Open WebUI เท่านั้น — ไม่ส่งเข้า API/เว็บ |
| `WEBUI_SECRET_KEY`, `OPEN_WEBUI_ENABLE_SIGNUP` | Open WebUI |
| `JENKINS_ADMIN_ID`, `JENKINS_ADMIN_PASSWORD`, `JENKINS_GIT_URL`, `JENKINS_GIT_BRANCH`, `GIT_CREDENTIAL_ID` | Jenkins controller (JCasC) |

## สิ่งที่ห้ามทำ

- ห้ามใส่ secret ใน `NEXT_PUBLIC_*` หรือ commit `.env*` (ยกเว้น `.example`)
- ห้ามเปิด `AUTH_FIXTURES_ENABLED` ใน local/staging — API จะไม่ start
- ห้ามใช้ `demo:reset` หรือ `perf:seed` กับฐานที่ไม่ได้ mark ไว้ — คำสั่งจะปฏิเสธเอง
