import { describe, expect, it } from 'vitest';
import { ParentOauthStateStore } from './parent-oauth-state.js';

describe('ParentOauthStateStore', () => {
  it('consumes only the matching browser-bound state once', () => {
    const states = new ParentOauthStateStore();
    states.create('state', 'http://localhost:5174', 1_000);
    expect(states.consume('state', 'state', 1_100)).toMatchObject({ redirect: 'http://localhost:5174' });
    expect(states.consume('state', 'state', 1_100)).toBeUndefined();
  });
  it('rejects mismatched and expired state while pruning expired entries', () => {
    const states = new ParentOauthStateStore();
    states.create('mismatch', 'http://localhost:5174', 1_000);
    expect(states.consume('mismatch', 'other', 1_100)).toBeUndefined();
    states.create('expired', 'http://localhost:5174', 1_000);
    expect(states.consume('expired', 'expired', 601_001)).toBeUndefined();
  });
});
