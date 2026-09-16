import { describe, expect, it } from 'vitest';
import { parentWorkbox } from './vite.config';

describe('Parent PWA cache policy', () => {
  it('has no runtime cache and excludes API, payment, media and evidence navigation', () => {
    expect(parentWorkbox.runtimeCaching).toEqual([]);
    const denylist = parentWorkbox.navigateFallbackDenylist;
    for (const path of ['/api/parent/session', '/payment/instruction', '/media/a', '/evidence/a']) expect(denylist.some((rule) => rule.test(path))).toBe(true);
  });
});
