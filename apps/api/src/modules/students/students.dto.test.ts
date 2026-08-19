import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateStudentDto, ListStudentsDto, UpdateStudentDto } from './students.dto.js';

describe('Student DTOs', () => {
  it('trims identity fields and rejects empty or overlong values', async () => {
    const dto = plainToInstance(CreateStudentDto, { fullName: '  Bé An  ', nickname: '  An  ' });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ fullName: 'Bé An', nickname: 'An' });
    await expect(validate(plainToInstance(CreateStudentDto, { fullName: '   ' }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(UpdateStudentDto, { fullName: 'a'.repeat(101) }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateStudentDto, { fullName: 'Bé An', nickname: 'a'.repeat(101) }))).resolves.not.toHaveLength(0);
  });

  it('accepts only valid list status and pagination bounds', async () => {
    await expect(validate(plainToInstance(ListStudentsDto, { status: 'ACTIVE', page: '1', pageSize: '20' }))).resolves.toHaveLength(0);
    await expect(validate(plainToInstance(ListStudentsDto, { status: 'ARCHIVED', page: '0', pageSize: '101' }))).resolves.not.toHaveLength(0);
  });
});
