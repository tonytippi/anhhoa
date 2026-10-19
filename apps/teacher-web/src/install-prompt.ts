import { useEffect, useState } from 'react';

// Install suggestion for the PWA. Chromium browsers hand us `beforeinstallprompt` to show their own
// install dialog; iOS Safari has no such API, so it gets Share → Add to Home Screen steps instead.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export type InstallMode = 'hidden' | 'prompt' | 'ios';
const snoozeMs = 30 * 24 * 60 * 60 * 1000;
let deferred: InstallEvent | undefined;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
// Listen at import time: the event can fire before any component mounts.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = undefined;
    installed = true;
    notify();
  });
}
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
const snoozed = (key: string) => {
  const until = Number(localStorage.getItem(key) ?? 0);
  return Number.isFinite(until) && until > Date.now();
};
const mode = (key: string): InstallMode => {
  if (installed || standalone() || snoozed(key)) return 'hidden';
  if (deferred) return 'prompt';
  return ios() ? 'ios' : 'hidden';
};

export function useInstallPrompt(storageKey: string) {
  const [current, setCurrent] = useState<InstallMode>(() => (typeof window === 'undefined' ? 'hidden' : mode(storageKey)));
  useEffect(() => {
    const update = () => setCurrent(mode(storageKey));
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, [storageKey]);
  const install = async () => {
    const event = deferred;
    if (!event) return;
    deferred = undefined;
    await event.prompt();
    const choice = await event.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    if (choice.outcome === 'accepted') installed = true;
    else localStorage.setItem(storageKey, String(Date.now() + snoozeMs));
    setCurrent(mode(storageKey));
  };
  const dismiss = () => {
    localStorage.setItem(storageKey, String(Date.now() + snoozeMs));
    setCurrent('hidden');
  };
  return { mode: current, install, dismiss };
}
