// Credential references used by the exported workflows. Values are bound at import time
// by `pnpm ai:up` from your env files; exports never contain secrets.
export const CREDENTIALS = {
  worker: { id: 'ecWorkerToken001', name: 'Employee Console worker token' },
  scheduler: { id: 'ecSchedToken0001', name: 'Employee Console scheduler token' },
  gemini: { id: 'ecGeminiApiKey01', name: 'Gemini API key' },
};
