import { afterEach, describe, expect, it, vi } from 'vitest';
import { observeNetworkStatus } from './network-status';

describe('observeNetworkStatus', () => {
  afterEach(() => vi.restoreAllMocks());

  it('thông báo ngay khi khởi tạo lúc browser đang ngoại tuyến', () => {
    const onlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, value: false });
    const offline = vi.fn();
    const cleanup = observeNetworkStatus({ onOffline: offline, onOnline: vi.fn() });
    try {
      expect(offline).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
      if (onlineDescriptor) Object.defineProperty(Navigator.prototype, 'onLine', onlineDescriptor);
    }
  });

  it('thông báo một lần cho mỗi đợt mất mạng và reset khi trực tuyến', () => {
    const offline = vi.fn(); const online = vi.fn();
    const cleanup = observeNetworkStatus({ onOffline: offline, onOnline: online });
    window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('offline'));
    expect(offline).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('offline'));
    expect(online).toHaveBeenCalledTimes(1); expect(offline).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('dọn listener khi unmount', () => {
    const offline = vi.fn(); const online = vi.fn();
    const cleanup = observeNetworkStatus({ onOffline: offline, onOnline: online });
    cleanup();
    window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online'));
    expect(offline).not.toHaveBeenCalled(); expect(online).not.toHaveBeenCalled();
  });
});
