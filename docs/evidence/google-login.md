# Google Login — manual smoke (real provider)

สถานะ: **BLOCKED** — ต้องมี `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URIs (:3000 และ :3100) และอีเมลใน `ADMIN_EMAILS`

สิ่งที่ผ่านแล้วโดยไม่ใช้ Google จริง (ไม่นับแทนหลักฐานนี้): mock OIDC provider ใน `apps/api/test/integration/auth.test.ts` (PKCE S256, state, nonce, issuer, audience, expiry, email_verified, allowlist, session rotation, account link conflict)

Checklist เมื่อได้ credentials:

| ขั้น | dev :3000 | staging :3100 |
| --- | --- | --- |
| Sign in with Google → Employees, ชื่อ/role ถูกต้อง | | |
| Sign out → กลับ Login, `/employees` redirect ไป Login | | |
| บัญชีที่ไม่อยู่ใน allowlist → Access denied | | |
| (ถ้ามี) Viewer: ไม่เห็น Salary/ปุ่มแก้ไข | | |
