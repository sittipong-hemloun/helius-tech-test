# infra — Docker, Jenkins, PostgreSQL init

ไฟล์ที่ประกอบระบบรันจริง ตัวที่เรียกใช้อยู่ **นอก** folder นี้: `compose.yaml` (dev: postgres + Jenkins profile `ci`), `compose.staging.yaml` (staging :3100), `Jenkinsfile`, และ `scripts/staging.mjs` / `scripts/ci-up.mjs` — เปลี่ยน path หรือชื่อไฟล์ที่นี่ต้องแก้ตัวเรียกเหล่านั้นพร้อมกัน

## `docker/` — image ของ web และ API

- **build context คือ root ของ repo** (`docker build -f infra/docker/<x>.Dockerfile .`) ไม่ใช่ folder นี้; `.dockerignore` อยู่ที่ root
- ทั้งสอง Dockerfile `COPY` `package.json` ของ **ทุก workspace package** (`apps/*`, `packages/api-client`, `tests/e2e`) ก่อน `pnpm install --frozen-lockfile` — **เพิ่ม/ลบ workspace package ต้องแก้ทั้งสองไฟล์** ไม่งั้น lockfile ไม่ตรงและ build ล้ม
- เวอร์ชัน pnpm (`corepack prepare pnpm@…`) และ Node image tag ต้องตรงกับ `packageManager` ใน `package.json` และ `.node-version`
- ไม่ copy `.env` เข้า image — config มาจาก environment ตอนรัน; web ฝัง `API_INTERNAL_URL` ตอน build (`http://api:3001` ใน Compose)
- API image ต้องมี OpenSSL ก่อน install Prisma และ build `dist-scripts/` ไว้ให้ staging รัน seed/migrate (`apps/api/AGENTS.md`); เปลี่ยน healthcheck แล้วต้องตรงกับ route จริง (`/api/health/ready`, `/employees`)
- image tag = commit SHA (`<sha>-dirty` ถ้า working tree ไม่สะอาด — D-30)

## `jenkins/` — CI/CD

- `Dockerfile` + `casc.yaml` (Configuration as Code) + `plugins.txt` ประกอบ controller ที่ :8080; `agent.mjs` เปิด inbound agent บนเครื่อง host (มี Node 24, pnpm, Docker); `agent/` เป็น runtime ถูก gitignore
- **plugin ทุกตัวใน `plugins.txt` pin เวอร์ชันแล้ว** (รวม dependency, D-44) — อัปเดตแบบตั้งใจ: แก้เวอร์ชัน → `pnpm ci:up` rebuild → รัน pipeline ให้ผ่าน → commit; ห้ามใช้ `latest` และห้ามกลบ error ตอน install
- pipeline อยู่ที่ `Jenkinsfile` (root); ค่าลับเข้าผ่าน environment หรือ secret file (`${JENKINS_ADMIN_PASSWORD}`, `/run/secrets/staging.env`) ห้ามฮาร์ดโค้ดใน `casc.yaml`

## `postgres/init-databases.sh`

สร้าง role/ฐานข้อมูลแยกสำหรับ app (`NOCREATEDB`) และ test runner (`CREATEDB`, เป็นเจ้าของเฉพาะฐาน `employee_console_test_*`) — D-43 สคริปต์ **ต้อง idempotent**: รันซ้ำทุก `pnpm dev:up` และทุก staging deploy เพื่อปรับ volume เดิมให้ตรงโครง role อย่าใช้คำสั่งที่ล้มเมื่อมีอยู่แล้ว และอย่าพิมพ์รหัสผ่าน
