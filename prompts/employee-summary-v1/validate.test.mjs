// node --test prompts/employee-summary-v1/validate.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { checkNarrative, EMPTY_TEMPLATE, interpretGemini } from './validate.mjs';

const seed = JSON.parse(readFileSync(new URL('./fixtures/01-seed.json', import.meta.url))).snapshot;
const good = {
  headline: 'ภาพรวมพนักงานจากข้อมูลปัจจุบัน',
  bullets: [
    'มีพนักงานทั้งหมด 5 รายการ แบ่งเป็น Active 4 รายการ และ In Active 1 รายการ',
    'Engineering มี 2 รายการ ส่วน Marketing, Sales และ HR มีแผนกละ 1 รายการ',
    'รายการที่มีสถานะ In Active อยู่ในแผนก Engineering',
  ],
};

test('PRD example narrative passes', () => assert.deepEqual(checkNarrative(good, seed), { ok: true, errors: [] }));
test('invented numbers are caught', () => {
  const bad = { ...good, bullets: [...good.bullets.slice(0, 2), 'อัตราการลาออก 12 เปอร์เซ็นต์'] };
  assert.match(checkNarrative(bad, seed).errors.join(), /NUMBER_NOT_IN_SNAPSHOT:12/);
});
test('total must be stated and salary talk is forbidden', () => {
  const noTotal = { headline: 'สรุป', bullets: ['Active 4 รายการ', 'In Active 1 รายการ', 'มี 4 แผนก'] };
  assert.ok(checkNarrative(noTotal, seed).errors.includes('TOTAL_NOT_STATED'));
  const salary = { ...good, bullets: [...good.bullets.slice(0, 2), 'ไม่มีข้อมูลเงินเดือน 5 รายการ'] };
  assert.ok(checkNarrative(salary, seed).errors.includes('FORBIDDEN_CONTENT'));
});
test('template passes for the empty fixture', () => {
  const empty = JSON.parse(readFileSync(new URL('./fixtures/02-empty.json', import.meta.url))).snapshot;
  assert.equal(checkNarrative(EMPTY_TEMPLATE, empty).ok, true);
});
test('provider errors map to worker codes', () => {
  assert.equal(interpretGemini(429, {}, seed).errorCode, 'PROVIDER_RATE_LIMIT');
  assert.equal(interpretGemini(400, { error: { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] } }, seed).errorCode, 'PROVIDER_AUTH_ERROR');
  assert.equal(interpretGemini(404, {}, seed).errorCode, 'MODEL_UNAVAILABLE');
  assert.equal(interpretGemini(503, {}, seed).errorCode, 'PROVIDER_UNAVAILABLE');
  assert.equal(interpretGemini(0, null, seed, 'timeout of 30000ms exceeded').errorCode, 'PROVIDER_TIMEOUT');
  assert.equal(interpretGemini(200, { candidates: [{ content: { parts: [{ text: 'not json' }] } }] }, seed).errorCode, 'INVALID_MODEL_OUTPUT');
  const ok = interpretGemini(200, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(good) }] } }] }, seed);
  assert.equal(ok.ok, true);
});
