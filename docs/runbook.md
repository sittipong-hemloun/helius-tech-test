# Runbook

คำสั่งทุกคำสั่งรันจาก root ของ repo ด้วย Node 24 และ pnpm 12 (`corepack enable`)

## 1. ตั้งเครื่องครั้งแรก

```bash
pnpm install
```

```bash
pnpm run setup
```

```bash
pnpm dev:up
```

แล้วเติมค่าภายนอกใน `.env` (ดู README "ค่าที่ต้องเติมเอง") และรัน `pnpm run setup` อีกครั้งเพื่อคัดลอกค่า Google/allowlist ไป `.env.staging`

## 2. Google OAuth client

1. Google Cloud Console → APIs & Services → OAuth consent screen: User type External (หรือ Internal ถ้ามี Workspace), เพิ่มอีเมลของคุณเป็น test user, scopes `openid email profile`
2. Credentials → Create credentials → OAuth client ID → Web application
3. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback` และ `http://localhost:3100/api/auth/google/callback`
4. ใส่ `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS` ใน `.env` → `pnpm run setup` → restart `pnpm dev` (และ `pnpm staging:restart` สำหรับ staging)
5. Smoke จริง: เปิด http://localhost:3000 → Sign in with Google → ต้องไปหน้า Employees; Sign out → กลับ Login; บัญชีที่ไม่อยู่ใน allowlist → หน้า Access denied

## 3. Dev

```bash
pnpm dev
```

- พอร์ต API มาจาก `PORT` — ถ้าพอร์ตชน ให้เปลี่ยนทั้ง `PORT` และ `API_INTERNAL_URL`
- `pnpm run doctor` ตรวจทุกอย่างโดยไม่พิมพ์ secret

## 4. Reset ข้อมูล demo

```bash
pnpm demo:reset --confirm-reset
```

ลบ employees/reports/idempotency แล้ว seed 5 records ใหม่ (ID ถัดไป = 106) เก็บ users/sessions ไว้ ทำได้เฉพาะ APP_ENV local/staging และฐานที่ mark ว่า demo — สำหรับ staging:

```bash
node scripts/staging.mjs reset --confirm-reset
```

## 5. Local staging (CD target)

```bash
pnpm staging:up
```

ลำดับ: build `employee-console/api:<sha>` และ `web:<sha>` → start postgres → **pg_dump backup** (ถ้ามี schema แล้ว) → `prisma migrate deploy` → seed เฉพาะการ bootstrap ครั้งแรก → start api → web → smoke → บันทึก manifest (current/previous/history) ขั้นใดล้ม (migrate, health, smoke) จะ redeploy tag ที่ดีล่าสุดอัตโนมัติ และบันทึก `failed` ไว้ใน manifest

สถานะ deploy อยู่ที่ `~/.employee-console/staging/` (`manifest.json`, `backups/`) — ใช้ร่วมกันระหว่างคำสั่งในเครื่องและ Jenkins (เปลี่ยนได้ด้วย `STAGING_STATE_DIR`); สำเนา manifest อยู่ที่ `.deploy/staging-manifest.json` ใน workspace

```bash
pnpm staging:smoke
```

ตรวจ liveness, readiness (DB + migration), หน้า Login, static asset, API บังคับ auth (401), `/internal` ไม่ถูกเปิดผ่านเว็บ (404), และสถานะ Google config (presence เท่านั้น — login จริงต้องตรวจมือ)

```bash
pnpm staging:restart
```

redeploy tag ปัจจุบันเพื่อให้ค่าใน `.env.staging` ที่แก้ (เช่น `REPORTS_ENABLED`, Google client) มีผล

```bash
pnpm staging:rollback
```

กลับไป tag ก่อนหน้า (`previous` ใน manifest) โดย **ไม่ย้อน schema** (migration ออกแบบให้ expand-compatible) ถ้าต้องย้อน schema ให้ restore backup ที่ทำไว้ก่อน migrate:

```bash
node scripts/staging.mjs restore --file=$HOME/.employee-console/staging/backups/<file>.sql --tag=<sha ที่ตรงกับ backup> --confirm-restore
```

คำสั่งนี้หยุด api/web → drop + create `employee_console_staging` โดยให้ app role เป็นเจ้าของ → โหลด dump ด้วย app role (object ทั้งหมดเป็นของ app role) → deploy tag ที่ระบุ → smoke

## 6. AI reports (n8n + Gemini)

1. ใส่ `GEMINI_API_KEY` ใน `.env`
2. เลือกปลายทาง: staging (ค่าเริ่มต้น `N8N_INTERNAL_API_URL=http://api-staging:3001/internal/v1`) หรือ dev (`http://host.docker.internal:<PORT>/internal/v1`) — บน Docker Desktop (macOS/Windows) container เข้าถึง loopback ของ host ผ่าน `host.docker.internal` ได้ จึงให้ API ฟัง `HOST=127.0.0.1` ตามเดิม **อย่าเปลี่ยนเป็น `0.0.0.0`** (จะเปิด dev API ให้ทั้ง LAN); บน Linux ให้ใช้ปลายทาง staging แทน
3. ```bash
   pnpm ai:up
   ```
   เปิด n8n (http://localhost:5678) + Open WebUI, import credentials (worker/scheduler bearer จาก env ของปลายทาง, Gemini key) และ workflows ทั้งสอง
4. สร้างบัญชี owner ของ n8n ครั้งแรกในเบราว์เซอร์
5. ตั้ง `REPORTS_ENABLED=true` ใน env ของปลายทาง แล้ว restart API (`pnpm staging:restart` หรือ `pnpm dev`)
6. ```bash
   pnpm ai:up --activate
   ```
7. ตรวจ: หน้า Integrations → Report worker = Available ภายใน 15 วินาที; Reports → Generate report → Ready พร้อมสรุปภาษาไทย

ปิด n8n/Gemini (`docker compose stop n8n`) → CRUD ยังใช้ได้, รายงานใหม่ค้าง Queued แล้ว FAILED `REPORT_DEADLINE_EXCEEDED` หลัง 10 นาที

## 7. Open WebUI

1. `pnpm ai:up` (หรือ `docker compose --profile ai-workspace up -d open-webui`)
2. เปิด http://localhost:3002 → สร้างบัญชีแรก (เป็น admin)
3. ตั้ง `OPEN_WEBUI_ENABLE_SIGNUP=false` ใน `.env` แล้ว `docker compose --profile ai-workspace up -d open-webui`
4. Admin Panel → Settings → Connections → OpenAI API: URL `https://generativelanguage.googleapis.com/v1beta/openai` และ key = Gemini key (ตั้งให้จาก env แล้ว) → เลือก model `gemini-3.5-flash-lite`
5. วาง system prompt จาก `prompts/employee-summary-v1/system-prompt.txt` และ snapshot จาก `prompts/employee-summary-v1/fixtures/01-seed.json` (ไม่มีชื่อ/เงินเดือน) แล้วบันทึกคำตอบใน `docs/evidence/open-webui.md`

## 8. Jenkins

```bash
pnpm ci:up
```

- เปิด controller (Docker, http://localhost:8080, ผู้ใช้ `admin`, รหัสผ่าน = `JENKINS_ADMIN_PASSWORD` ใน `.env`) และ agent บนเครื่องนี้ (label `employee-console`, มี Node 24/pnpm/Docker)
- Job `employee-console` อ่าน `Jenkinsfile` จาก `JENKINS_GIT_URL` ถ้ามี ไม่งั้นใช้ repo ในเครื่อง (`file://<path>`, branch `main`) — commit ก่อน build
- Build with Parameters: `DEPLOY_STAGING` (deploy แม้ไม่ใช่ main), `RUN_PERF`
- Credentials: `employee-console-staging-env` (file) มาจาก `.env.staging` ที่ mount read-only
- `pnpm ci:up` ตรวจหลัง start ว่า JCasC ถูก apply (job + parameters + node `host-agent`) และ plugin ทั้ง 78 ตัวตรงเวอร์ชันที่ pin ไม่ตรง = exit 1
- เปลี่ยนเวอร์ชัน plugin: แก้ `infra/jenkins/plugins.txt` → `pnpm ci:up` → รัน pipeline → commit (D-44)
- หยุด: `pnpm ci:up --stop`

## 9. Performance

```bash
pnpm perf:run --label=baseline
```

ใช้ฐาน `employee_console_perf` (สร้างใหม่ทุกครั้ง, mark performance), 10,000 synthetic records (seed 42), API production build 1 instance pool 10, k6 ใน Docker, Lighthouse desktop 3 รอบ ผลอยู่ใน `tests/performance/results/<label>/` สรุปใน `docs/performance.md` — หยุด Jenkins/n8n/Open WebUI ก่อนวัด

## 10. ปัญหาที่พบบ่อย

| อาการ | ตรวจ / แก้ |
| --- | --- |
| หน้าเว็บบอก "can't reach its API" | `pnpm run doctor` → API ไม่รันหรือพอร์ตชน; ตรวจ `API_INTERNAL_URL` |
| Login แล้วกลับมาหน้า Login ด้วย `login_failed` | redirect URI ไม่ตรง, นาฬิกาเครื่องเพี้ยน, หรือ client secret ผิด (ดู log `oidc_callback_rejected`) |
| Access denied `not_allowed` | อีเมลไม่อยู่ใน `ADMIN_EMAILS`/`VIEWER_EMAILS` (แก้แล้ว restart API) |
| API start ไม่ได้ "Invalid configuration" | อ่านรายการปัญหาที่พิมพ์ออกมา (เช่น อีเมลซ้ำสองกลุ่ม, SESSION_SECRET สั้น) |
| Reports ตอบ 503 `AI_NOT_CONFIGURED` | `REPORTS_ENABLED=false` |
| Worker Unavailable | n8n ไม่รัน/ไม่ active หรือ token ไม่ตรงกับ API ปลายทาง (รัน `pnpm ai:up` ใหม่) |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm approve-builds` |
| Test ล้มด้วย `TEST_DB_PASSWORD missing` หรือ `permission denied to create database` | `.env` สร้างก่อนมี test role → `pnpm run setup` (เติมค่าที่ขาด) แล้ว `pnpm dev:up` (ปรับ role ของ volume เดิม, D-43) |
