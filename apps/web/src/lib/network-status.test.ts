import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeNetworkStatus } from './network-status';

describe('observeNetworkStatus', () => {
  afterEach(() => vi.restoreAllMocks());
  it('thông báo một lần cho mỗi đợt mất mạng và reset khi trực tuyến', () => {
    const offline = vi.fn(); const online = vi.fn();
    const cleanup = observeNetworkStatus({ onOffline: offline, onOnline: online });
    window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('offline'));
    expect(offline).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('offline'));
    expect(online).toHaveBeenCalledTimes(1); expect(offline).toHaveBeenCalledTimes(2);
    cleanup();
  });
});
