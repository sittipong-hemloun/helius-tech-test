import { ValidationPipe, type ValidationError } from '@nestjs/common';
import { Errors, type FieldErrorDetail } from '../common/api-exception.js';
import { decodeRuleMessage } from './field-rule.decorator.js';

/** Fields the server owns; sending them is a contract error, not just "unknown". */
const READ_ONLY_FIELDS = new Set(['id', 'lastUpdatedDate', 'version', 'createdAt', 'updatedAt', 'departmentName', 'role']);

export function flattenErrors(errors: ValidationError[], parent = ''): FieldErrorDetail[] {
  const out: FieldErrorDetail[] = [];
  for (const err of errors) {
    const field = parent ? `${parent}.${err.property}` : err.property;
    for (const [constraint, message] of Object.entries(err.constraints ?? {})) {
      if (constraint === 'whitelistValidation') {
        out.push(
          READ_ONLY_FIELDS.has(err.property)
            ? { field, code: 'READ_ONLY_FIELD', message: `${err.property} is assigned by the system and cannot be sent.` }
            : { field, code: 'UNKNOWN_FIELD', message: `${err.property} is not an accepted field.` },
        );
      } else {
        out.push({ field, ...decodeRuleMessage(message) });
      }
    }
    if (err.children?.length) out.push(...flattenErrors(err.children, field));
  }
  return out;
}

const base = {
  whitelist: true,
  forbidNonWhitelisted: true,
  // No implicit conversion: "false" must never become a boolean (PRD §7.1).
  transform: false,
  transformOptions: { enableImplicitConversion: false },
  validationError: { target: false, value: false },
  stopAtFirstError: true,
  forbidUnknownValues: false,
} as const;

export const bodyValidationPipe = new ValidationPipe({
  ...base,
  exceptionFactory: (errors) => Errors.validation(flattenErrors(errors)),
});

export const queryValidationPipe = new ValidationPipe({
  ...base,
  exceptionFactory: (errors) => Errors.invalidQuery(flattenErrors(errors)),
});
