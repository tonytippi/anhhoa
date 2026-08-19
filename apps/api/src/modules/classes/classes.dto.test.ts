import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateClassDto, TransferClassDto, UpdateClassDto } from './classes.dto.js';

describe('CreateClassDto', () => {
  it('trims names and rejects whitespace-only or names over 100 characters', async () => {
    const trimmed = plainToInstance(CreateClassDto, { name: '  Mầm 1  ', monthlyTuition: 0 });
    await expect(validate(trimmed)).resolves.toHaveLength(0);
    expect(trimmed.name).toBe('Mầm 1');
    await expect(validate(plainToInstance(CreateClassDto, { name: '   ', monthlyTuition: 0 }))).resolves.not.toHaveLength(0);
    await expect(validate(plainToInstance(CreateClassDto, { name: 'a'.repeat(101), monthlyTuition: 0 }))).resolves.not.toHaveLength(0);
  });
});

it('rejects a transfer payload without a UUID destinationClassId', async () => {
  const input = Object.assign(new TransferClassDto(), { destinationClassId: 'not-a-uuid' });
  expect(await validate(input)).not.toHaveLength(0);
});

describe('UpdateClassDto', () => {
  it('trims a 100-character name and rejects a longer name', async () => {
    const name = `  ${'a'.repeat(100)}  `;
    const trimmed = plainToInstance(UpdateClassDto, { name, monthlyTuition: 0 });
    await expect(validate(trimmed)).resolves.toHaveLength(0);
    expect(trimmed.name).toHaveLength(100);
    await expect(validate(plainToInstance(UpdateClassDto, { name: 'a'.repeat(101), monthlyTuition: 0 }))).resolves.not.toHaveLength(0);
  });
});
