import { describe, expect, it } from 'vitest';
import { seed } from './seed.js';

describe('development fixture seed', () => {
  it('refuses to seed without explicit development authorization', async () => {
    const previous = process.env.ALLOW_DEVELOPMENT_SEED;
    delete process.env.ALLOW_DEVELOPMENT_SEED;
    await expect(seed()).rejects.toThrow('ALLOW_DEVELOPMENT_SEED=true');
    if (previous) process.env.ALLOW_DEVELOPMENT_SEED = previous;
  });
});
