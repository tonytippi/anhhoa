import { describe, expect, it } from 'vitest';
import { assertDevelopmentEnvironment, seed } from './seed.js';

describe('development fixture seed', () => {
  it('refuses to seed outside development before opening a database connection', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      expect(assertDevelopmentEnvironment).toThrow('NODE_ENV=development');
      await expect(seed()).rejects.toThrow('NODE_ENV=development');
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });
});
