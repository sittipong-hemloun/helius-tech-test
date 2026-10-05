import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateEmployeeDto } from '../../src/employees/employee.dto.js';

const DANA = { name: 'Dana Lee', departmentId: 'engineering', salary: '62000.00', joinDate: '2026-09-01', isActive: true };

/** Field names that fail validation for this body, like the API's ValidationPipe would report. */
async function invalidFields(body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateEmployeeDto, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

describe('CreateEmployeeDto', () => {
  it('accepts a valid employee', async () => {
    expect(await invalidFields(DANA)).toEqual([]);
  });

  it('trims and NFC-normalizes the name', () => {
    expect(plainToInstance(CreateEmployeeDto, { ...DANA, name: '  Zoë ' }).name).toBe('Zoë');
  });

  it.each(['', '   ', 'Line\nBreak', 'Tab\tName', 'a'.repeat(101)])('rejects name %j', async (name) => {
    expect(await invalidFields({ ...DANA, name })).toEqual(['name']);
  });

  it.each(['65000', '0', '0.5', '9999999999.99'])('accepts salary %j', async (salary) => {
    expect(await invalidFields({ ...DANA, salary })).toEqual([]);
  });

  it.each(['', '-1', '65000.999', '6.5e4', '65,000.00', '99999999999', 65000])('rejects salary %j', async (salary) => {
    expect(await invalidFields({ ...DANA, salary })).toEqual(['salary']);
  });

  it.each(['2024-02-29', '1900-01-01', '2100-12-31'])('accepts join date %j', async (joinDate) => {
    expect(await invalidFields({ ...DANA, joinDate })).toEqual([]);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-09-01T00:00:00Z', '1899-12-31', '2101-01-01', '09/01/2026'])(
    'rejects join date %j',
    async (joinDate) => {
      expect(await invalidFields({ ...DANA, joinDate })).toEqual(['joinDate']);
    },
  );

  it.each(['Engineering', 'finance', ''])('rejects department %j', async (departmentId) => {
    expect(await invalidFields({ ...DANA, departmentId })).toEqual(['departmentId']);
  });

  it.each(['true', 1, null])('rejects isActive %j', async (isActive) => {
    expect(await invalidFields({ ...DANA, isActive })).toEqual(['isActive']);
  });

  it('rejects fields the server owns', async () => {
    expect(await invalidFields({ ...DANA, id: 1, version: 2, lastUpdatedDate: '2026-01-01' })).toEqual(['id', 'version', 'lastUpdatedDate']);
  });
});
