export function oauthDeniedRedirect(destination: string, reason?: 'denied'): string {
  try {
    const url = new URL(destination);
    if (reason === 'denied') url.searchParams.set('reason', 'denied');
    else url.searchParams.delete('reason');
    return url.toString();
  } catch {
    return destination;
  }
}
