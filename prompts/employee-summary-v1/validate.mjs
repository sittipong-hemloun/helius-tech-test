// Output checks for employee-summary-v1, shared by the n8n worker (inlined at build time)
// and the evaluation script. Structure + numbers: every number in the text must exist in
// the snapshot, and the total headcount must be stated. This catches invented figures;
// it does not prove the Thai wording is right, which is why fixtures are reviewed by a person.
export function checkNarrative(narrative, snapshot) {
  const errors = [];
  const plain = (s) => typeof s === 'string' && s.trim().length > 0;
  const badFormat = (s) => /<\/?[a-z!][^>]*>/i.test(s) || /(^\s*[#>*-]\s)|(\*\*)|(```)/.test(s) || /[\r\n\u2028\u2029]/.test(s);
  if (!narrative || typeof narrative !== 'object' || Array.isArray(narrative)) return { ok: false, errors: ['NOT_AN_OBJECT'] };
  const keys = Object.keys(narrative).sort().join(',');
  if (keys !== 'bullets,headline') errors.push(`UNEXPECTED_KEYS:${keys}`);
  if (!plain(narrative.headline) || [...narrative.headline].length > 120 || badFormat(narrative.headline)) errors.push('HEADLINE_INVALID');
  const bullets = Array.isArray(narrative.bullets) ? narrative.bullets : [];
  if (bullets.length < 3 || bullets.length > 5) errors.push('BULLET_COUNT');
  bullets.forEach((b, i) => {
    if (!plain(b) || [...b].length > 240 || badFormat(b)) errors.push(`BULLET_${i}_INVALID`);
  });
  if (errors.length) return { ok: false, errors };

  const text = [narrative.headline, ...bullets].join(' ').replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
  const allowed = new Set([0, snapshot.totalEmployees, snapshot.activeEmployees, snapshot.inactiveEmployees, snapshot.departments.length]);
  for (const d of snapshot.departments) [d.total, d.active, d.inactive].forEach((n) => allowed.add(n));
  const [y, m, day] = String(snapshot.businessDate).split('-').map(Number);
  [y, y + 543, m, day].forEach((n) => allowed.add(n));
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, '')));
  const invented = numbers.filter((n) => !allowed.has(n));
  if (invented.length) errors.push(`NUMBER_NOT_IN_SNAPSHOT:${[...new Set(invented)].join('|')}`);
  if (snapshot.totalEmployees > 0 && !numbers.includes(snapshot.totalEmployees)) errors.push('TOTAL_NOT_STATED');
  if (/เงินเดือน|salary|บาท|฿|@|เลิกจ้าง|ควรจ้าง/i.test(text)) errors.push('FORBIDDEN_CONTENT');
  return { ok: errors.length === 0, errors };
}

export const EMPTY_TEMPLATE = {
  headline: 'ยังไม่มีข้อมูลพนักงานสำหรับรายงานนี้',
  bullets: [
    'ไม่มีรายการพนักงานในข้อมูล ณ เวลาที่ถ่าย snapshot',
    'ยังไม่มีข้อมูลแผนกที่มีพนักงานให้สรุป',
    'เพิ่มข้อมูลพนักงานก่อน แล้วจึงออกรายงานใหม่',
  ],
};

/** Gemini generateContent body (native API, structured output, no tools/grounding). */
export function geminiRequest(systemPrompt, responseSchema, snapshot) {
  return {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(snapshot) }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema,
    },
  };
}

/** Maps a Gemini HTTP result to the worker contract: {ok, narrative} or {ok:false, errorCode}. */
export function interpretGemini(statusCode, body, snapshot, transportError) {
  if (transportError) {
    return { ok: false, errorCode: /timeout|timed out|ETIMEDOUT|ECONNABORTED/i.test(transportError) ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE' };
  }
  const reason = JSON.stringify(body?.error ?? {});
  if (statusCode === 429) return { ok: false, errorCode: 'PROVIDER_RATE_LIMIT' };
  if (statusCode === 401 || statusCode === 403 || /API_KEY_INVALID|PERMISSION_DENIED/.test(reason)) return { ok: false, errorCode: 'PROVIDER_AUTH_ERROR' };
  if (statusCode === 404) return { ok: false, errorCode: 'MODEL_UNAVAILABLE' };
  if (statusCode >= 500 || statusCode === 0) return { ok: false, errorCode: 'PROVIDER_UNAVAILABLE' };
  if (statusCode === 400) return { ok: false, errorCode: 'INVALID_SNAPSHOT' };
  if (statusCode !== 200) return { ok: false, errorCode: 'PROVIDER_UNAVAILABLE' };
  if (body?.promptFeedback?.blockReason) return { ok: false, errorCode: 'CONTENT_REJECTED' };
  const candidate = body?.candidates?.[0];
  if (!candidate) return { ok: false, errorCode: 'INVALID_MODEL_OUTPUT' };
  if (['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(candidate.finishReason)) return { ok: false, errorCode: 'CONTENT_REJECTED' };
  const text = (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('');
  let narrative;
  try {
    narrative = JSON.parse(text);
  } catch {
    return { ok: false, errorCode: 'INVALID_MODEL_OUTPUT' };
  }
  if (narrative && typeof narrative === 'object') {
    narrative = { headline: String(narrative.headline ?? '').trim(), bullets: Array.isArray(narrative.bullets) ? narrative.bullets.map((b) => String(b).trim()) : narrative.bullets };
  }
  const check = checkNarrative(narrative, snapshot);
  return check.ok ? { ok: true, narrative } : { ok: false, errorCode: 'INVALID_MODEL_OUTPUT', detail: check.errors };
}
