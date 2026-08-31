import { describe, expect, it } from 'vitest';
import { oauthDeniedRedirect } from './oauth-denied-redirect.js';

describe('oauthDeniedRedirect', () => {
  it.each([
    ['http://localhost:5173', 'http://localhost:5173/?reason=denied'],
    ['http://localhost:5173/login?source=oauth#entry', 'http://localhost:5173/login?source=oauth&reason=denied#entry'],
  ])('adds the denied signal without losing configured URL parts', (input, expected) => {
    expect(oauthDeniedRedirect(input, 'denied')).toBe(expected);
  });

  it('keeps a neutral redirect free of the denied signal and tolerates malformed configuration', () => {
    expect(oauthDeniedRedirect('http://localhost:5173/login?reason=denied#entry')).toBe('http://localhost:5173/login#entry');
    expect(oauthDeniedRedirect('not a URL', 'denied')).toBe('not a URL');
  });
  it('allows only the caller-provided public OAuth state reason while preserving URL parts', () => {
    expect(oauthDeniedRedirect('http://localhost:5173/login?source=oauth#entry', 'oauth_state_invalid')).toBe('http://localhost:5173/login?source=oauth&reason=oauth_state_invalid#entry');
  });
});
