# packages/api-client — สัญญา API ฝั่ง client

แพ็กเกจ TypeScript ล้วน (ไม่มี build — `exports` ชี้ `src/index.ts`) ที่ `apps/web` import เป็น `@employee-console/api-client`

## ไฟล์ไหน generate ไฟล์ไหนเขียนเอง

| ไฟล์ | ที่มา |
| --- | --- |
| `openapi.json` | **generate** จาก `apps/api` (`apps/api/scripts/generate-openapi.ts`) |
| `src/schema.d.ts` | **generate** จาก `openapi.json` ด้วย `openapi-typescript` |
| `src/index.ts` | เขียนเอง — alias ของ DTO (`Employee`, `Department`, …) และ `Envelope`, `PageMeta`, `EmployeeListMeta`, `ApiErrorBody` |

**ห้ามแก้ `openapi.json` และ `schema.d.ts` ด้วยมือ** — แก้ที่ controller/DTO ใน `apps/api` แล้วรัน

```bash
pnpm openapi:generate
```

แล้ว commit ผลทั้งสองไฟล์ Jenkins รันคำสั่งเดียวกันแล้ว `git diff --exit-code -- packages/api-client` ถ้าต่างจากที่ commit pipeline ล้ม

## เมื่อไรต้องแก้ `src/index.ts`

- เพิ่ม DTO ที่ UI ต้องใช้ → เพิ่ม alias จาก `Schemas[...]`
- เปลี่ยนรูป response/error envelope ใน `apps/api/src/common/envelope.ts` หรือ `http-exception.filter.ts` → แก้ `Envelope`/`ApiErrorBody` ที่นี่ให้ตรง (ส่วนนี้ generator ไม่ครอบคลุม)

`apps/web` ต้องไม่นิยามชนิดของ response ซ้ำเอง ให้ import จากแพ็กเกจนี้ และ `web.Dockerfile` copy folder นี้เข้า image — ถ้าเพิ่มไฟล์นอก `src/` ที่ web ต้องใช้ ให้ตรวจ Dockerfile ด้วย
