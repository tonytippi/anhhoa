import { afterEach, describe, expect, it, vi } from 'vitest';
import { disablePush, enablePush, pushState } from './web-push';

const config = (enabled = true) => new Response(JSON.stringify({ data: { enabled, publicKey: enabled ? 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' : null } }));
const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn().mockResolvedValue(true) };
function browser({ ios = false, standalone = false, permission = 'default', subscribed = false, grant = 'granted' } = {}) {
  const pushManager = { getSubscription: vi.fn().mockResolvedValue(subscribed ? subscription : null), subscribe: vi.fn().mockResolvedValue(subscription) };
  vi.stubGlobal('navigator', { userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)' : 'Mozilla/5.0 (X11; Linux x86_64)', maxTouchPoints: 0, standalone, serviceWorker: { getRegistration: vi.fn().mockResolvedValue({ pushManager }) } });
  vi.stubGlobal('PushManager', function PushManager() {});
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn().mockResolvedValue(grant) });
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: standalone }));
  window.matchMedia = globalThis.matchMedia;
  return pushManager;
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('teacher web push opt-in', () => {
  it('asks iPhone users to install the app before offering notifications', async () => {
    browser({ ios: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(config()));
    expect(await pushState('school')).toBe('install-required');
  });
  it('stays hidden when the server has no VAPID keys', async () => {
    browser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(config(false)));
    expect(await pushState('school')).toBe('hidden');
  });
  it('subscribes after permission and registers the subscription with the API', async () => {
    const pushManager = browser();
    const fetch = vi.fn((url: string, _init?: RequestInit) => Promise.resolve(url.endsWith('/config') ? config() : new Response(JSON.stringify({ data: { subscribed: true } }))));
    vi.stubGlobal('fetch', fetch);
    expect(await pushState('school')).toBe('off');
    expect(await enablePush('school')).toBe('on');
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    const [url, init] = fetch.mock.calls.find(([url]) => url.endsWith('/push/subscriptions'))!;
    expect(url).toBe('/api/teacher/schools/school/push/subscriptions');
    expect(JSON.parse(String(init!.body))).toMatchObject({ endpoint: 'https://fcm.googleapis.com/fcm/send/x' });
  });
  it('reports a blocked permission and removes the subscription on disable', async () => {
    browser({ permission: 'denied' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(config()));
    expect(await pushState('school')).toBe('denied');
    browser({ subscribed: true });
    const fetch = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    expect(await disablePush()).toBe('off');
    expect(fetch).toHaveBeenCalledWith('/api/teacher/schools/device/push/subscriptions/remove', expect.objectContaining({ method: 'POST' }));
    expect(subscription.unsubscribe).toHaveBeenCalled();
  });
});
