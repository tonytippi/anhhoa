import { describe, expect, it } from 'vitest';
import { parsePort } from './main.js';

describe('parsePort', () => {
  it('accepts valid ports and rejects malformed values', () => {
    expect(parsePort('3000')).toBe(3000);
    expect(() => parsePort('3000x')).toThrow('PORT must be an integer');
    expect(() => parsePort('0')).toThrow('PORT must be an integer');
  });
});
