/**
 * A field rule is a pure function returning either the normalized value or a
 * coded error. The same rules back the DTO decorators (validation) and the services
 * (normalization), so client-visible codes and stored values cannot drift apart.
 */
export type RuleResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

export type FieldRule<T = unknown> = (value: unknown) => RuleResult<T>;

export const ok = <T>(value: T): RuleResult<T> => ({ ok: true, value });
export const fail = (code: string, message: string): RuleResult<never> => ({ ok: false, code, message });

export function unwrap<T>(result: RuleResult<T>): T {
  if (!result.ok) throw new Error(`Rule failed unexpectedly: ${result.code}`);
  return result.value;
}
