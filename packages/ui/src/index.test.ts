import { describe, expect, it } from 'vitest';
import { statusLabel } from './index.js';

describe('statusLabel', () => {
  it('returns the supplied stateless status tone', () => {
    expect(statusLabel('success')).toBe('success');
  });
});
