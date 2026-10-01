import { registerDecorator, type ValidationArguments } from 'class-validator';
import type { FieldRule } from './rule.js';

const SEPARATOR = '\u001f';

/**
 * Binds a FieldRule to a DTO property. `optional` skips only `undefined`, so an
 * explicit `null` is still validated (and rejected) — unlike class-validator's IsOptional.
 * The failure code travels inside the message and is decoded by the exception factory.
 */
export function Rule(rule: FieldRule, options: { optional?: boolean } = {}): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'fieldRule',
      target: target.constructor,
      propertyName: String(propertyKey),
      validator: {
        validate(value: unknown) {
          if (value === undefined && options.optional) return true;
          return rule(value).ok;
        },
        defaultMessage(args: ValidationArguments) {
          const result = rule(args.value);
          return result.ok ? 'INVALID' : `${result.code}${SEPARATOR}${result.message}`;
        },
      },
    });
  };
}

export function decodeRuleMessage(message: string): { code: string; message: string } {
  const idx = message.indexOf(SEPARATOR);
  if (idx === -1) return { code: 'INVALID', message };
  return { code: message.slice(0, idx), message: message.slice(idx + 1) };
}
