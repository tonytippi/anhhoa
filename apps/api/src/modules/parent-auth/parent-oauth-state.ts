export interface ParentOauthState { redirect: string; expiresAt: number; }

export class ParentOauthStateStore {
  private readonly states = new Map<string, ParentOauthState>();
  create(state: string, redirect: string, now = Date.now()): void {
    this.prune(now);
    this.states.set(state, { redirect, expiresAt: now + 600_000 });
  }
  consume(state: string, browserState: string | undefined, now = Date.now()): ParentOauthState | undefined {
    this.prune(now);
    const saved = this.states.get(state);
    this.states.delete(state);
    return state && state === browserState && saved && saved.expiresAt >= now ? saved : undefined;
  }
  private prune(now: number): void {
    for (const [state, value] of this.states) if (value.expiresAt < now) this.states.delete(state);
  }
}
