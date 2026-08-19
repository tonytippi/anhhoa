import { expect, it } from 'vitest';
import { ApiError } from '../../app/api/client';
import { parseStudent } from './api';

const base = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: null, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

it('requires a matching UUID class summary exactly when classId is present', () => {
  expect(parseStudent({ ...base, classId: null, class: null })).toMatchObject({ classId: null, class: null });
  expect(parseStudent({ ...base, classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', class: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1' } })).toMatchObject({ class: { name: 'Mầm 1' } });
  for (const value of [{ ...base, classId: null, class: { id: 'b2e36687-69b4-4e89-8ec0-141ff397837f', name: 'Mầm 1' } }, { ...base, classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', class: null }, { ...base, classId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', class: { id: 'invalid', name: 'Mầm 1' } }]) expect(() => parseStudent(value)).toThrow(ApiError);
});
