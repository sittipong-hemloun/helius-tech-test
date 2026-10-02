# Configuration

ค่าทั้งหมดถูกตรวจตอน API start (`apps/api/src/config/app-config.ts`, zod) — ถ้าผิด process จะหยุดพร้อมรายการปัญหา (ไม่แสดงค่า secret) ค่า timeout/limit ทั้งหมดเป็น typed config ตาม PRD ไม่กระจายเป็น magic number

ไฟล์: `.env` (dev) และ `.env.staging` (staging) สร้างโดย `pnpm run setup` จาก `.env.example` / `.env.staging.example` — ทั้งคู่อยู่ใน `.gitignore` ค่า secret ที่ต้องสุ่มจะถูกสร้างให้อัตโนมัติ ไม่มีค่าภายนอกที่ต้องกรอก

## API / runtime

| Variable | Default | ความหมาย / กฎที่บังคับ |
| --- | --- | --- |
| `APP_ENV` | `local` | `local` · `staging` · `test` · `performance` — คุม guard ทั้งหมด |
| `NODE_ENV` | `development` | ไม่ใช้แทน APP_ENV |
| `APP_TIMEZONE` | `Asia/Bangkok` | วันธุรกิจของ Last Updated Date |
| `PUBLIC_APP_ORIGIN` | `http://localhost:3000` | origin ของเว็บ (ต้องเป็น origin เท่านั้น); HTTP ได้เฉพาะ loopback |
| `PORT` / `HOST` | `3001` / `127.0.0.1` | listener ของ NestJS (container ใช้ `0.0.0.0`) |
| `API_INTERNAL_URL` | `http://localhost:3001` | ปลายทาง rewrite `/api/*` ของ Next.js — **ถูกฝังตอน build**; staging image build ด้วย `http://api:3001` |
| `DATABASE_URL` | สร้างโดย setup | connection ของ API/Prisma |
| `DB_POOL_MAX` | `10` | pool ของ Prisma adapter |
| `TRUST_PROXY` | `loopback, linklocal, uniquelocal` | จำกัด trust proxy ตาม topology (ไม่เปิด `true`) |
| `LOG_LEVEL` | `info` | JSON logs; debug ไม่พิมพ์ body/secret |
| `RATE_LIMIT_ENABLED` | `true` | ปิดได้ใน test |
| `PERF_RATE_LIMIT_OVERRIDE` | `false` | `true` ได้เฉพาะ performance |
| `BUILD_COMMIT_SHA` / `APP_VERSION` | `unknown` / `1.0.0` | อยู่ใน log `api_started` และ OpenAPI; image ตั้งจาก build arg |

ค่าคงที่ตาม PRD ที่อยู่ใน config: rate limit read 300 / write 60 ต่อนาทีต่อ IP, body 32 KB, idempotency key 24 ชั่วโมง

## Docker / tools (อยู่ใน `.env`)

| Variable | ใช้โดย |
| --- | --- |
| `POSTGRES_PASSWORD`, `APP_DB_USER`, `APP_DB_PASSWORD`, `POSTGRES_HOST_PORT` | postgres container (role แอปแยกจาก superuser, `NOCREATEDB`) |
| `TEST_DB_USER`, `TEST_DB_PASSWORD` | role แยกสำหรับ integration/E2E/Newman/perf (`CREATEDB`, เป็นเจ้าของเฉพาะ `employee_console_test_*` และ `employee_console_perf`) — setup สร้างรหัสให้, `pnpm dev:up` ปรับ role ของ volume เดิมให้ตรง |
| `JENKINS_ADMIN_ID`, `JENKINS_ADMIN_PASSWORD`, `JENKINS_GIT_URL`, `JENKINS_GIT_BRANCH`, `GIT_CREDENTIAL_ID` | Jenkins controller (JCasC) |

## สิ่งที่ห้ามทำ

- ห้ามใส่ secret ใน `NEXT_PUBLIC_*` หรือ commit `.env*` (ยกเว้น `.example`)
- ห้ามใช้ `demo:reset` หรือ `perf:seed` กับฐานที่ไม่ได้ mark ไว้ — คำสั่งจะปฏิเสธเอง
