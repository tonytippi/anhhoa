export type OAuthDeniedReason = 'denied' | 'oauth_state_invalid';

export function oauthDeniedRedirect(destination: string, reason?: OAuthDeniedReason): string {
  try {
    const url = new URL(destination);
    if (reason) url.searchParams.set('reason', reason);
    else url.searchParams.delete('reason');
    return url.toString();
  } catch {
    return destination;
  }
}
