// Remembers who last signed in on this browser so the login card can offer one-click re-entry.
// Display-only: Google still verifies the identity and the API still authorizes every request.
export type LastAccount = { email: string; displayName?: string | null; pictureUrl?: string | null };
const key = 'passionedu.lastAccount';

export function lastAccount(): LastAccount | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<LastAccount> | null;
    return typeof value?.email === 'string' && value.email ? { email: value.email, displayName: typeof value.displayName === 'string' ? value.displayName : null, pictureUrl: typeof value.pictureUrl === 'string' && value.pictureUrl.startsWith('https://') ? value.pictureUrl : null } : undefined;
  } catch { return undefined; }
}

export function rememberAccount(account: LastAccount): void {
  try { localStorage.setItem(key, JSON.stringify({ email: account.email, displayName: account.displayName ?? null, pictureUrl: account.pictureUrl ?? null })); } catch { /* storage unavailable */ }
}

export function forgetAccount(): void {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

export function accountLoginUrl(loginUrl: string, account: LastAccount): string {
  return `${loginUrl}?login_hint=${encodeURIComponent(account.email)}`;
}

export function otherAccountLoginUrl(loginUrl: string): string {
  return `${loginUrl}?prompt=select_account`;
}

export function accountInitials(account: LastAccount): string {
  const words = (account.displayName || account.email).split(/[\s@.]+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1]![0] : '')).toUpperCase() || '?';
}
