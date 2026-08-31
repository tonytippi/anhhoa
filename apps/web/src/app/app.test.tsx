import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { focusManager } from '@tanstack/react-query';
import { App } from './app';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.history.pushState({}, '', '/');
});

it('chỉ mount workspace sau khi API trả identity hợp lệ', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: admin }), { status: 200 })));
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Đang kiểm tra phiên' })).toBeVisible();
  expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeVisible();
  expect(screen.getByRole('complementary', { name: 'Điều hướng quản trị' })).toBeVisible();
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' }, signal: undefined });
});

it('ẩn workspace và hiển thị đăng nhập khi API trả 401', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }), { status: 401 })));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Google' })).toBeVisible();
  expect(screen.queryByRole('complementary', { name: 'Điều hướng quản trị' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument();
});

it('hiển thị lỗi OAuth bị từ chối mà không lộ dữ liệu workspace', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })));
  window.history.pushState({}, '', '/?reason=denied');
  render(<App />);
  expect(await screen.findByText('Email này không có quyền truy cập Ánh Hoa Admin.')).toBeVisible();
  expect(screen.queryByText('Tổng quan')).not.toBeInTheDocument();
});

it('hiển thị hướng dẫn đăng nhập lại khi phiên đã hết hạn', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'SESSION_EXPIRED' } }), { status: 401 })));
  render(<App />);
  expect(await screen.findByText('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.')).toBeVisible();
});

it('hiển thị hướng dẫn thử lại cho OAuth state không hợp lệ', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })));
  window.history.pushState({}, '', '/?reason=oauth_state_invalid');
  render(<App />);
  expect(await screen.findByText('Phiên xác thực Google đã hết hạn hoặc không hợp lệ. Vui lòng thử đăng nhập lại.')).toBeVisible();
});

it('401 không có tín hiệu dùng thông báo đăng nhập trung tính', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 })));
  render(<App />);
  expect(await screen.findByText('Vui lòng đăng nhập để tiếp tục.')).toBeVisible();
  expect(screen.queryByText('Email này không có quyền truy cập Ánh Hoa Admin.')).not.toBeInTheDocument();
});

it('403 cũng ẩn workspace và hiển thị đăng nhập', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN' } }), { status: 403 })));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Google' })).toBeVisible();
  expect(screen.queryByRole('complementary', { name: 'Điều hướng quản trị' })).not.toBeInTheDocument();
});

it('response identity không hợp lệ không mount workspace', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'admin-1' } }), { status: 200 })));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Không thể kiểm tra phiên' })).toBeVisible();
  expect(screen.queryByRole('complementary', { name: 'Điều hướng quản trị' })).not.toBeInTheDocument();
});

it('ẩn identity cache cũ ngay khi refetch trả 401', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: admin }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeVisible();
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  expect(await screen.findByRole('heading', { name: 'Đăng nhập Google' })).toBeVisible();
  expect(screen.queryByRole('complementary', { name: 'Điều hướng quản trị' })).not.toBeInTheDocument();
});

it('giữ workspace ẩn và cho thử lại khi bootstrap lỗi mạng', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Network error')).mockResolvedValueOnce(new Response(JSON.stringify({ data: admin }), { status: 200 })));
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Không thể kiểm tra phiên' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeVisible();
  expect(screen.getByRole('complementary', { name: 'Điều hướng quản trị' })).toBeVisible();
});
