/** Route `[id]` segment → employee ID, or null when it is not a positive integer of at most 10 digits. */
export function parseEmployeeId(raw: string): number | null {
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}
