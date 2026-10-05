# การใช้ AI coding assistant ในโปรเจกต์นี้

เอกสารนี้บันทึกวิธีสั่งงาน AI และปัญหาจริงที่เจอระหว่างพัฒนา (REQ-06, REQ-07, PRD §17.2) — ใช้ประกอบการตอบคำถามช่วง Q&A และ Live Coding ไม่มีรายการใดที่แต่งขึ้น ทุกข้อมีหลักฐานใน commit หรือ test

## วิธีทำงาน

1. **ส่ง PRD ทั้งฉบับให้ AI** (Claude Code) พร้อมคำสั่งให้ทำ M0–M7 โดยไม่ถามซ้ำเรื่องที่ PRD ตัดสินใจแล้ว
2. **Compatibility spike ก่อนเขียนฟีเจอร์** — ตรวจ dist-tag ของ npm, peer dependencies และให้ API boot + query + session store ได้จริงก่อน
3. **Vertical slice + test ทันที** — เขียน rule → DTO → service → integration test บน PostgreSQL จริง แล้วค่อยทำ UI
4. **ให้ test เป็นตัวตัดสิน** ไม่ใช่การอ่านโค้ด: unit (กฎ), integration (DB จริง, concurrency), E2E (built app), Newman (สัญญา API)
5. **แยกงานที่อิสระให้ subagent** เมื่อ contract นิ่งแล้ว (เช่น Postman collection) แล้วตรวจผลด้วยการรันจริง
6. **ตัดให้เรียบง่าย (D-56)** — ให้ AI เสนอระดับการตัดเป็นตัวเลือก (cleanup อย่างเดียว / ตัดของกันพัง / ตัด delivery) ผู้ใช้เลือก แล้วเขียนใหม่โดยใช้ test เดิมเป็นตัวกำหนดว่าพฤติกรรมไหนต้องคงไว้ และรัน integration ซ้ำใน time zone อื่นเพื่อพิสูจน์ว่าวันที่ไม่เลื่อน

## Prompt ที่ได้ผล

| สถานการณ์ | Prompt (ย่อ) | ทำไมได้ผล |
| --- | --- | --- |
| เริ่มงาน | "อ่าน PRD แล้ว implement จนเสร็จ ขอค่า env หลังเขียนโค้ดครบ" | กำหนดขอบเขตและเวลาที่จะขอข้อมูลภายนอกชัดเจน AI จึงไม่หยุดถามระหว่างทาง |
| เลือกเวอร์ชัน | "ตรวจ `npm view <pkg> dist-tags` และ peerDependencies ก่อนติดตั้ง" | จับได้ว่า `latest` ของ Prisma เป็น RC และ TypeScript latest เป็น 7 (native) |
| กฎข้อมูล | "เขียนกฎเป็น pure function แล้วใช้ซ้ำใน DTO, service, seed, test" | error code ตรงกันทุกชั้น และ unit test ได้ละเอียด |
| Concurrency | "พิสูจน์ด้วย test ที่ยิง 5 คำขอพร้อมกันด้วย key เดียว" | ยืนยันพฤติกรรมด้วยผลจริง ไม่ใช่คำอธิบาย |
| Live Coding (ซ้อม) | "เพิ่ม filter Join Date ช่วงเริ่ม/จบ: แก้ query rule → DTO → service SQL → UI filter → test" | ระบุ contract ที่เปลี่ยนก่อน แล้วให้ AI แก้ทีละชั้น |

## ปัญหาจริงที่เจอและวิธีแก้

แถวที่อ้างถึง Idempotency-Key, Jenkins, staging, `@Rule()`, สคริปต์ OpenAPI หรือ exception filter เป็นประวัติก่อน D-56 (ส่วนนั้นถูกตัดแล้ว) ส่วนแถวที่ขึ้นต้นด้วย **ประวัติก่อน D-46** เป็นปัญหาในส่วน Login/AI reports ที่ตัดออกแล้ว เก็บไว้เป็นบันทึกการใช้ AI ไม่ใช่โค้ดที่ยังมีอยู่ ข้อ 2 และ 12 บทเรียนยังใช้ได้ แต่ `AuthenticationGuard` และ guard ของหน้า docs ถูกลบไปพร้อม D-46 แล้ว (หลัง D-56 Swagger ใช้ค่า default จึงมี `/api/docs-yaml` ด้วย — เป็นเอกสาร API สาธารณะ ไม่มีข้อมูลลับ)

| # | อาการ | สาเหตุ | วิธีแก้ / หลักฐาน |
| --- | --- | --- | --- |
| 1 | `pnpm add prisma` จะได้ 8.0.0-rc | dist-tag `latest` ของ prisma ชี้ RC | pin 7.10.0 (D-14) |
| 2 | Nest DI error `can't resolve dependencies of AuthenticationGuard (?, …)` ตอนรัน script OpenAPI ด้วย `tsx` | esbuild ไม่ emit `design:paramtypes` | compile ด้วย `tsc -p tsconfig.scripts.json` ก่อนรัน; Vitest ใช้ unplugin-swc (D-13) |
| 3 | TypeScript `TS1161: Unterminated regular expression` | escape `\u2028` ใน regex ถูกเครื่องมือเขียนไฟล์แปลงเป็นอักขระ line separator จริง | แทนกลับเป็น escape sequence และตรวจทั้ง repo |
| 4 | **ประวัติก่อน D-46** · Test OIDC กรณี nonce/iss/aud ผิด "ผ่าน" ผิดเหตุผล | `oauth2-mock-server` ยิง `beforeTokenSigning` ให้ access token ก่อน id_token; `once()` จึงแก้ token ผิดตัว | hook แก้เฉพาะ token ที่มี nonce/aud ของ client (commit `test(api)`) |
| 5 | JSON พังได้ `BAD_REQUEST` แทน `MALFORMED_JSON` | Nest แปลง SyntaxError ของ body-parser เป็น BadRequestException | map ใน exception filter โดยไม่ echo ข้อความ parser |
| 6 | **ประวัติก่อน D-46** · Session fixture หมดอายุทันทีใน test ที่ใช้ FakeClock | connect-pg-simple เทียบ `expire` กับเวลาจริง | anchor `expire` กับเวลาจริง ส่วน absolute timeout ใช้ FakeClock (D-24) |
| 7 | `pnpm install` ล้มด้วย `ERR_PNPM_IGNORED_BUILDS` | pnpm 12 บล็อก install script จนกว่าจะอนุมัติ | `pnpm approve-builds` → `allowBuilds` ใน workspace |
| 8 | eslint-config-next แจ้ง peer ไม่ตรง | plugin ยังไม่รองรับ ESLint 10 | ใช้ ESLint 9.39.5 (D-16) |
| 9 | กรอก Salary ใหม่ในหน้า Edit ได้ `62000.0063000.00` | onFocus เปลี่ยนค่า (เอา comma ออก) แล้ว selection หาย ข้อความใหม่ไปต่อท้าย — **Playwright จับได้** | format เฉพาะตอน blur (D-31), commit `test(e2e)` |
| 10 | React lint: setState ใน effect ของหน้า Edit | ใช้ state เก็บสำเนาที่กำลังแก้ | ใช้ query แบบ `editing` (ไม่ refetch ระหว่างแก้) แทน state |
| 11 | ESLint ไม่มี config ฝั่ง API ทำให้ stage Static checks ใน Jenkins จะล้ม | เพิ่ม script `lint` แต่ยังไม่มี config | เพิ่ม `apps/api/eslint.config.mjs` (typescript-eslint) |
| 12 | `/api/docs-yaml` เปิดสาธารณะ — **reviewer subagent จับได้** | `@nestjs/swagger` เสิร์ฟ YAML โดย default (`raw: true`) แต่ middleware guard แค่ `/api/docs` กับ `/api/openapi.json` | `raw: ['json']` + guard path เพิ่ม + test `docs-yaml → 401/404` |
| 13 | Form สร้างพนักงานเปลี่ยน Idempotency-Key เมื่อได้ 5xx | ถือว่า 5xx เป็นคำตอบแน่นอน ทั้งที่ API อาจ commit แล้วหรือ proxy ตอบระหว่าง restart | `outcomeUnknown` รวม 5xx → คง key; ถ้าแก้ค่าแล้วชน `IDEMPOTENCY_CONFLICT` ให้เตือนตรวจรายการ |
| 14 | **ประวัติก่อน D-46** · Logout ตอบ 204 แม้ลบ session ใน DB ไม่สำเร็จ | callback ของ `session.destroy` ทิ้ง error | logout ใช้ `destroySession(req, { strict: true })` → 503 เมื่อ store ล้ม |
| 15 | **ประวัติก่อน D-46** · Scheduled report ที่ชน unique index อาจตอบ 409 แทน 200 | เดาชนิด index จากข้อความ error ของ driver | ตัดสินจากข้อมูล (`findScheduled(day)`) + ใช้เวลาเดียวกันทั้งคำขอ; test scheduler พร้อมกัน 4 คำขอ |
| 16 | Staging migrate ใน Jenkins ล้ม (`Can't write to …/@prisma/engines`) ทั้งที่ทุก CI gate ผ่าน (build #3/#4) | stage prod-deps ไม่มี OpenSSL → Prisma เลือก engine openssl-1.1 และ pnpm side-effects cache นำ engine ผิดตัวกลับมาใช้ | ติดตั้ง OpenSSL ใน base stage + ปิด side-effects cache + ตรวจ engine ตอน build; build #4 พิสูจน์ auto-rollback, build #5 ผ่าน |
| 17 | Jenkins agent online/offline สลับไปมาหลัง restart controller | JVM ของ agent รอบก่อนค้างเป็น orphan (wrapper ตายแต่ไม่ส่ง signal ต่อ) แล้วต่อเข้ามาด้วยชื่อ node เดียวกัน | wrapper ส่ง SIGTERM/SIGINT/SIGHUP ต่อให้ JVM |
| 18 | `buildWithParameters` ตอบ 400 "not parameterized" หลัง restart controller | JCasC สร้าง job ใหม่ทุกครั้งที่ start; parameters จาก Jenkinsfile หายจนกว่าจะรัน build หนึ่งครั้ง | ประกาศ parameters ใน job DSL ด้วย + `pnpm ci:up` ตรวจ job/parameters/node/plugin versions |
| 19 | App role มี `CREATEDB` (ใช้ร่วมกับ test runner) — **reviewer subagent จับได้** | ใช้ role เดียวทั้งรันแอปและสร้างฐาน test | แยก test role (D-43); `init-databases.sh` idempotent รันซ้ำทุก `dev:up`/deploy เพื่อปรับ volume เดิม |
| 20 | **ประวัติก่อน D-46** · Playwright E2E error `Protocol error (Network.getResponseBody): No resource with given identifier found` ใน `viewer.spec.ts` | `page.on('response')` ดักอ่าน `res.text()` แบบ async ระหว่างที่ browser navigate ไปหน้าอื่น ทำให้ context/body หลุด | wrap `res.text()` ด้วย try-catch ละเว้นคำขอที่ถูก navigate หนีไปแล้ว |
| 21 | Jenkins build #7 (`51ff45e`) ล้มที่ Static checks: `TS2307 Cannot find module '../../src/app/login/page.js'` ทั้งที่ gate ในเครื่องผ่านครบ | workspace ของ agent เก็บ `apps/web/.next` (gitignore, checkout ไม่ลบ) จาก build #6 ก่อน D-46 และ `tsconfig` include `.next/types` | ทำซ้ำในเครื่องด้วยการเติม route เก่าใน `validator.ts` → web `typecheck` = `next typegen && tsc` (D-47) |
| 22 | หลังเปลี่ยนเป็น Prisma `contains` ค้นหา `%` แล้วได้ทั้ง 5 แถว (D-56) | Prisma ส่งค่า `contains` เข้า ILIKE โดยไม่ escape `%`/`_` — **integration test AC-23 จับได้** | escape `\`, `%`, `_` ใน `EmployeesService.list` |
| 23 | PATCH `{"name": null}` ได้ 500 แทน 400 (D-56) | `PartialType` ใส่ `@IsOptional` ซึ่งข้ามค่า `null` → ไปชน NOT NULL ใน DB — **AI reviewer จับได้ระหว่างตรวจงาน** | `PartialType(CreateEmployeeDto, { skipNullProperties: false })` + test |

## สิ่งที่ AI ไม่ได้ทำแทน (ต้องใช้ข้อมูลจริงของผู้สมัคร)

> ช่วงที่ยังมี Google OAuth และ AI reports — ทั้งสองส่วนถูกตัดออกภายหลัง (D-46)

- Google OAuth client/secret, อีเมล Admin/Viewer, Gemini API key, Git remote — ไม่สร้างหรือเดาค่า
- การ login Google จริง, การรันรายงานกับ Gemini จริง และการทดลองใน Google AI Studio ต้องทำด้วยบัญชีผู้สมัคร
