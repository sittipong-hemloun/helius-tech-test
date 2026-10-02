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

## 2. Dev

```bash
pnpm dev
```

- พอร์ต API มาจาก `PORT` — ถ้าพอร์ตชน ให้เปลี่ยนทั้ง `PORT` และ `API_INTERNAL_URL`
- `pnpm run doctor` ตรวจทุกอย่างโดยไม่พิมพ์ secret

## 3. Reset ข้อมูล demo

```bash
pnpm demo:reset --confirm-reset
```

ลบ employees/idempotency แล้ว seed 5 records ใหม่ (ID ถัดไป = 106) ทำได้เฉพาะ APP_ENV local/staging และฐานที่ mark ว่า demo — สำหรับ staging:

```bash
node scripts/staging.mjs reset --confirm-reset
```

## 4. Local staging (CD target)

```bash
pnpm staging:up
```

ลำดับ: build `employee-console/api:<sha>` และ `web:<sha>` → start postgres → **pg_dump backup** (ถ้ามี schema แล้ว) → `prisma migrate deploy` → seed เฉพาะการ bootstrap ครั้งแรก → start api → web → smoke → บันทึก manifest (current/previous/history) ขั้นใดล้ม (migrate, health, smoke) จะ redeploy tag ที่ดีล่าสุดอัตโนมัติ และบันทึก `failed` ไว้ใน manifest

สถานะ deploy อยู่ที่ `~/.employee-console/staging/` (`manifest.json`, `backups/`) — ใช้ร่วมกันระหว่างคำสั่งในเครื่องและ Jenkins (เปลี่ยนได้ด้วย `STAGING_STATE_DIR`); สำเนา manifest อยู่ที่ `.deploy/staging-manifest.json` ใน workspace

```bash
pnpm staging:smoke
```

ตรวจ liveness, readiness (DB + migration), หน้า Employees, static asset, API ตอบผ่าน web origin (200) และ `/internal` ไม่ถูกเปิดผ่านเว็บ (404)

```bash
pnpm staging:restart
```

redeploy tag ปัจจุบันเพื่อให้ค่าใน `.env.staging` ที่แก้มีผล

```bash
pnpm staging:rollback
```

กลับไป tag ก่อนหน้า (`previous` ใน manifest) โดย **ไม่ย้อน schema** (migration ออกแบบให้ expand-compatible) — ยกเว้น `20261003000000_remove_login_and_reports` ซึ่งลบตาราง: rollback ไป image ที่เก่ากว่า migration นี้ต้อง restore backup ที่ทำไว้ก่อน migrate:

```bash
node scripts/staging.mjs restore --file=$HOME/.employee-console/staging/backups/<file>.sql --tag=<sha ที่ตรงกับ backup> --confirm-restore
```

คำสั่งนี้หยุด api/web → drop + create `employee_console_staging` โดยให้ app role เป็นเจ้าของ → โหลด dump ด้วย app role (object ทั้งหมดเป็นของ app role) → deploy tag ที่ระบุ → smoke

## 5. Jenkins

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

## 6. Performance

```bash
pnpm perf:run --label=baseline
```

ใช้ฐาน `employee_console_perf` (สร้างใหม่ทุกครั้ง, mark performance), 10,000 synthetic records (seed 42), API production build 1 instance pool 10, k6 ใน Docker, Lighthouse desktop 3 รอบ ผลอยู่ใน `tests/performance/results/<label>/` สรุปใน `docs/performance.md` — หยุด Jenkins ก่อนวัด

## 7. ปัญหาที่พบบ่อย

| อาการ | ตรวจ / แก้ |
| --- | --- |
| หน้า Employees แสดง error ตอนโหลด | `pnpm run doctor` → API ไม่รันหรือพอร์ตชน; ตรวจ `API_INTERNAL_URL` |
| API start ไม่ได้ "Invalid configuration" | อ่านรายการปัญหาที่พิมพ์ออกมา (เช่น `PUBLIC_APP_ORIGIN` เป็น HTTP นอก loopback) |
| `ERR_PNPM_IGNORED_BUILDS` | `pnpm approve-builds` |
| Test ล้มด้วย `TEST_DB_PASSWORD missing` หรือ `permission denied to create database` | `.env` สร้างก่อนมี test role → `pnpm run setup` (เติมค่าที่ขาด) แล้ว `pnpm dev:up` (ปรับ role ของ volume เดิม, D-43) |
