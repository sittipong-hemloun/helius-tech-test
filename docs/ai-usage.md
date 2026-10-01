# การใช้ AI coding assistant ในโปรเจกต์นี้

เอกสารนี้บันทึกวิธีสั่งงาน AI และปัญหาจริงที่เจอระหว่างพัฒนา (REQ-06, REQ-07, PRD §17.2) — ใช้ประกอบการตอบคำถามช่วง Q&A และ Live Coding ไม่มีรายการใดที่แต่งขึ้น ทุกข้อมีหลักฐานใน commit หรือ test

## วิธีทำงาน

1. **ส่ง PRD ทั้งฉบับให้ AI** (Claude Code) พร้อมคำสั่งให้ทำ M0–M7 โดยไม่ถามซ้ำเรื่องที่ PRD ตัดสินใจแล้ว
2. **Compatibility spike ก่อนเขียนฟีเจอร์** — ตรวจ dist-tag ของ npm, peer dependencies และให้ API boot + query + session store ได้จริงก่อน
3. **Vertical slice + test ทันที** — เขียน rule → DTO → service → integration test บน PostgreSQL จริง แล้วค่อยทำ UI
4. **ให้ test เป็นตัวตัดสิน** ไม่ใช่การอ่านโค้ด: unit (กฎ), integration (DB จริง, concurrency), E2E (built app), Newman (สัญญา API)
5. **แยกงานที่อิสระให้ subagent** เมื่อ contract นิ่งแล้ว (เช่น Postman collection) แล้วตรวจผลด้วยการรันจริง

## Prompt ที่ได้ผล

| สถานการณ์ | Prompt (ย่อ) | ทำไมได้ผล |
| --- | --- | --- |
| เริ่มงาน | "อ่าน PRD แล้ว implement จนเสร็จ ขอค่า env หลังเขียนโค้ดครบ" | กำหนดขอบเขตและเวลาที่จะขอข้อมูลภายนอกชัดเจน AI จึงไม่หยุดถามระหว่างทาง |
| เลือกเวอร์ชัน | "ตรวจ `npm view <pkg> dist-tags` และ peerDependencies ก่อนติดตั้ง" | จับได้ว่า `latest` ของ Prisma เป็น RC และ TypeScript latest เป็น 7 (native) |
| กฎข้อมูล | "เขียนกฎเป็น pure function แล้วใช้ซ้ำใน DTO, service, seed, test" | error code ตรงกันทุกชั้น และ unit test ได้ละเอียด |
| Concurrency | "พิสูจน์ด้วย test ที่ยิง 5 คำขอพร้อมกันด้วย key เดียว" | ยืนยันพฤติกรรมด้วยผลจริง ไม่ใช่คำอธิบาย |
| Live Coding (ซ้อม) | "เพิ่ม filter Join Date ช่วงเริ่ม/จบ: แก้ query rule → DTO → service SQL → UI filter → test" | ระบุ contract ที่เปลี่ยนก่อน แล้วให้ AI แก้ทีละชั้น |

## ปัญหาจริงที่เจอและวิธีแก้

| # | อาการ | สาเหตุ | วิธีแก้ / หลักฐาน |
| --- | --- | --- | --- |
| 1 | `pnpm add prisma` จะได้ 8.0.0-rc | dist-tag `latest` ของ prisma ชี้ RC | pin 7.10.0 (D-14) |
| 2 | Nest DI error `can't resolve dependencies of AuthenticationGuard (?, …)` ตอนรัน script OpenAPI ด้วย `tsx` | esbuild ไม่ emit `design:paramtypes` | compile ด้วย `tsc -p tsconfig.scripts.json` ก่อนรัน; Vitest ใช้ unplugin-swc (D-13) |
| 3 | TypeScript `TS1161: Unterminated regular expression` | escape ` ` ใน regex ถูกเครื่องมือเขียนไฟล์แปลงเป็นอักขระ line separator จริง | แทนกลับเป็น escape sequence และตรวจทั้ง repo |
| 4 | Test OIDC กรณี nonce/iss/aud ผิด "ผ่าน" ผิดเหตุผล | `oauth2-mock-server` ยิง `beforeTokenSigning` ให้ access token ก่อน id_token; `once()` จึงแก้ token ผิดตัว | hook แก้เฉพาะ token ที่มี nonce/aud ของ client (commit `test(api)`) |
| 5 | JSON พังได้ `BAD_REQUEST` แทน `MALFORMED_JSON` | Nest แปลง SyntaxError ของ body-parser เป็น BadRequestException | map ใน exception filter โดยไม่ echo ข้อความ parser |
| 6 | Session fixture หมดอายุทันทีใน test ที่ใช้ FakeClock | connect-pg-simple เทียบ `expire` กับเวลาจริง | anchor `expire` กับเวลาจริง ส่วน absolute timeout ใช้ FakeClock (D-24) |
| 7 | `pnpm install` ล้มด้วย `ERR_PNPM_IGNORED_BUILDS` | pnpm 12 บล็อก install script จนกว่าจะอนุมัติ | `pnpm approve-builds` → `allowBuilds` ใน workspace |
| 8 | eslint-config-next แจ้ง peer ไม่ตรง | plugin ยังไม่รองรับ ESLint 10 | ใช้ ESLint 9.39.5 (D-16) |
| 9 | กรอก Salary ใหม่ในหน้า Edit ได้ `62000.0063000.00` | onFocus เปลี่ยนค่า (เอา comma ออก) แล้ว selection หาย ข้อความใหม่ไปต่อท้าย — **Playwright จับได้** | format เฉพาะตอน blur (D-31), commit `test(e2e)` |
| 10 | React lint: setState ใน effect ของหน้า Edit | ใช้ state เก็บสำเนาที่กำลังแก้ | ใช้ query แบบ `editing` (ไม่ refetch ระหว่างแก้) แทน state |
| 11 | ESLint ไม่มี config ฝั่ง API ทำให้ stage Static checks ใน Jenkins จะล้ม | เพิ่ม script `lint` แต่ยังไม่มี config | เพิ่ม `apps/api/eslint.config.mjs` (typescript-eslint) |

## สิ่งที่ AI ไม่ได้ทำแทน (ต้องใช้ข้อมูลจริงของผู้สมัคร)

- Google OAuth client/secret, อีเมล Admin/Viewer, Gemini API key, Git remote — ไม่สร้างหรือเดาค่า
- การ login Google จริง, การรันรายงานกับ Gemini จริง และการทดลองใน Google AI Studio ต้องทำด้วยบัญชีผู้สมัคร (ดู `docs/acceptance.md` สถานะ BLOCKED/NOT RUN)
