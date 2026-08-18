export type NetworkStatusOptions = { onOffline: () => void; onOnline: () => void };

export function observeNetworkStatus({ onOffline, onOnline }: NetworkStatusOptions): () => void {
  let hasNotifiedForOutage = false;
  const offline = (): void => {
    if (!hasNotifiedForOutage) {
      hasNotifiedForOutage = true;
      onOffline();
    }
  };
  const online = (): void => {
    hasNotifiedForOutage = false;
    onOnline();
  };

  window.addEventListener('offline', offline);
  window.addEventListener('online', online);
  if (!navigator.onLine) offline();
  return () => {
    window.removeEventListener('offline', offline);
    window.removeEventListener('online', online);
  };
}
