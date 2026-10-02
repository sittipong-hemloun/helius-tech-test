# หลักฐาน Jenkins

Controller `jenkins/jenkins:2.580.1-lts-jdk21` (Docker, `pnpm ci:up`) + inbound agent `host-agent` (WebSocket) บนเครื่องนี้
Job `employee-console` สร้างโดย JCasC (`infra/jenkins/casc.yaml`) อ่าน `Jenkinsfile` จาก repo ในเครื่อง (`file://`, branch `main`, ไม่มี Git remote)
Plugin: 78 ตัว pin เวอร์ชันตรงใน `infra/jenkins/plugins.txt`; `plugins-resolved.txt` คือรายการที่อ่านกลับจาก controller ที่รันอยู่จริง

log ทุกไฟล์ในโฟลเดอร์นี้คือ `consoleText` ของ build นั้นโดยไม่ได้แก้ไข

| Build | Commit | ผล | เกิดอะไรขึ้น |
| --- | --- | --- | --- |
| [#1](build-1.log) | — | FAILURE | branch spec ของ SCM ไม่ตรงกับ repo ในเครื่อง (`Couldn't find any revision to build`) → แก้เป็น `branch('*/' + branchName)` ใน job DSL |
| [#2](build-2.log) | `72d6c9f` | FAILURE | ทุก gate ก่อน E2E ผ่าน; E2E keyboard (AC-35) ล้ม: test ใช้ `.focus()` จากสคริปต์ จึงไม่เกิด `:focus-visible` (outline `none`) → เขียน test ใหม่ให้กด Tab จริงผ่านทุก field และส่วนของวันที่ |
| [#3](build-3.log) | `a346e09` | FAILURE | CI gate ผ่านทั้งหมด; staging `migrate` ล้ม `Can't write to …/@prisma/engines` (stage prod-deps ไม่มี OpenSSL ทำให้ Prisma เลือก engine ผิด) deploy หยุดก่อนแทน api/web; ไม่มี rollback เพราะ state dir ร่วมยังไม่มี last-good tag ขณะนั้น |
| [#4](build-4.log) | `c06f5df` | FAILURE | migrate ล้มแบบเดิม (pnpm side-effects cache นำ engine ผิดตัวกลับมา) → **auto-rollback** ไป `c0e9d918585d` แล้ว smoke ✔ — นี่คือเส้นทาง rollback ของ AC-55 |
| [#5](build-5.log) | `a0dbe2f` | **SUCCESS** | ผ่านทุก stage; deploy `a0dbe2f64a76`, apply migration `20261002000000_perf_indexes`, smoke 7/7 ✔ |
| [#6](build-6.log) | `b1aa074` | **SUCCESS** | ผ่านทุก stage บน commit ที่ harden แล้ว (DB role แบบ least privilege, plugin pin, secret ของ test สุ่มทุกรอบ): unit ✔, integration 88/88, Newman 107 requests / 616 assertions / 0 failed, E2E 22 passed, image `b1aa0747ec84`, deploy staging (ปรับ role: `ALTER ROLE`), smoke 7/7 ✔ สองรอบ |

ลำดับ stage (#6): Checkout → Dependencies → Static checks (lint, typecheck, OpenAPI drift, secret scan) → Unit → Test DB → API / Postman → Build → E2E → Images → Deploy staging → Smoke → Performance (รันเมื่อ `RUN_PERF=true` เท่านั้น)

JUnit (unit, integration, prompt, Newman, Playwright) และ artifact (`test-results/`, `playwright-report/`, staging manifest) เก็บไว้ในแต่ละ build ของ Jenkins
