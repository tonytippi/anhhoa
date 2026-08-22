import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { pendingInvoices } from './api';
import { App } from './app';

describe('Parent PWA login shell', () => {
  it('shows only the Parent Google sign-in surface when bootstrap is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })));
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tiếp tục với Google' }).getAttribute('href')).toBe('/api/parent/auth/google');
  });
  it('clears the protected surface and routes to login even when logout fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'parent-1', email: 'parent@example.com', displayName: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'csrf' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 })));
    window.history.pushState({}, '', '/');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hóa đơn cần thanh toán' })).toBeNull();
  });
});

const parent = { id: 'parent-1', email: 'parent@example.com', displayName: null };
const students = [{ id: 'student-a', fullName: 'Bé An', nickname: 'An' }, { id: 'student-b', fullName: 'Bé Bình', nickname: null }];
const invoice = (id: string, student: string, billingMonth: string, paymentMethod: 'CASH' | 'TRANSFER' = 'TRANSFER', status: 'PENDING' | 'COMPLETED' = 'PENDING') => ({ id, student: { id: student === 'Bé An' ? 'student-a' : 'student-b', name: student, nickname: null }, billingMonth, status, total: 1500000, paymentMethod, items: [{ description: 'Học phí', feeGroup: 'TUITION', amount: 1500000, position: 1 }] });

function mockHome(invoices: ReturnType<typeof invoice>[], visibleStudents = students): void {
  vi.stubGlobal('fetch', vi.fn((input: string) => {
    if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
    if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: visibleStudents }), { status: 200 }));
    const filtered = input.includes('studentId=student-a') ? invoices.filter((entry) => entry.student.name === 'Bé An') : invoices;
    return Promise.resolve(new Response(JSON.stringify({ data: filtered, meta: { page: 1, pageSize: 100, total: filtered.length, pageCount: 1 } }), { status: 200 }));
  }));
}

describe('Parent Home', () => {
  it('groups pending invoices by the newest invoice and filters a selected student', async () => {
    mockHome([invoice('b-1', 'Bé Bình', '2026-08'), invoice('a-1', 'Bé An', '2026-08'), invoice('b-2', 'Bé Bình', '2026-09')]);
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hóa đơn cần thanh toán' })).toBeTruthy();
    await screen.findByRole('heading', { name: 'Bé Bình', level: 2 });
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(['Bé Bình', 'An']);
    expect(screen.getAllByText('Học sinh: Bé Bình')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'An' }));
    expect(await screen.findByRole('heading', { name: 'An', level: 2 })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Bé Bình', level: 2 })).toBeNull());
  });

  it('shows the cash instruction and no substitute cards for an empty response', async () => {
    mockHome([invoice('cash-1', 'Bé An', '2026-08', 'CASH')]);
    window.history.pushState({}, '', '/');
    const { unmount } = render(<App />);
    expect(await screen.findByText('Thanh toán tiền mặt tại nhà trường.')).toBeTruthy();
    expect(screen.getByText('1.500.000 VND')).toBeTruthy();
    unmount();
    mockHome([]);
    render(<App />);
    expect(await screen.findByText('Không còn Hóa đơn cần thanh toán')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem lịch sử' })).toBeTruthy();
    expect(screen.queryByText('Cần thanh toán')).toBeNull();
  });

  it('clears protected Home content when a protected request returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input.endsWith('/parent/me') ? { data: parent } : {}), { status: input.endsWith('/parent/me') ? 200 : 401 }))));
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hóa đơn cần thanh toán' })).toBeNull();
  });

  it('removes a revoked selected student and reloads the remaining protected surface', async () => {
    mockHome([invoice('a-1', 'Bé An', '2026-08'), invoice('b-1', 'Bé Bình', '2026-08')]);
    window.history.pushState({}, '', '/');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'An' }));
    await screen.findByRole('heading', { name: 'An', level: 2 });
    mockHome([invoice('b-1', 'Bé Bình', '2026-08')], [students[1]!]);
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'An' })).toBeNull());
    expect(await screen.findByRole('heading', { name: 'Bé Bình', level: 2 })).toBeTruthy();
  });

  it('loads every pending invoice page before Home groups the result', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [invoice('a-1', 'Bé An', '2026-08')], meta: { page: 1, pageSize: 100, total: 101, pageCount: 2 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [invoice('a-2', 'Bé An', '2026-07')], meta: { page: 2, pageSize: 100, total: 101, pageCount: 2 } }), { status: 200 })));
    await expect(pendingInvoices()).resolves.toHaveLength(2);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toContain('page=2');
  });

  it('keeps cards visible with an update indicator and shows the offline banner once', async () => {
    mockHome([invoice('a-1', 'Bé An', '2026-08')]);
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByText('Bạn đang ngoại tuyến. Dữ liệu có thể không mới.')).toBeTruthy();
    expect(await screen.findByText('Học sinh: Bé An')).toBeTruthy();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
});

describe('Parent invoice detail and History', () => {
  it('renders only read-only invoice detail and cash guidance without a payment action', async () => {
    const detail = invoice('cash-1', 'Bé An', '2026-08', 'CASH');
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
      if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: students }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ data: detail }), { status: 200 }));
    }));
    window.history.pushState({}, '', '/invoices/cash-1');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Chi tiết Hóa đơn' })).toBeTruthy();
    expect(await screen.findByText('Thanh toán tiền mặt tại nhà trường.')).toBeTruthy();
    expect(screen.getByText('Tổng cộng: 1.500.000 VND')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /thanh toán/i })).toBeNull();
  });

  it('requests completed History only, synchronizes filters and pages in the URL', async () => {
    const completed = invoice('done-1', 'Bé An', '2026-07', 'TRANSFER', 'COMPLETED');
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
      if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: students }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ data: [completed], meta: { page: 1, pageSize: 20, total: 21, pageCount: 2 } }), { status: 200 }));
    }));
    window.history.pushState({}, '', '/history?studentId=student-a&billingMonth=2026-07');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Lịch sử thanh toán' })).toBeTruthy();
    expect(await screen.findByText('Đã hoàn tất')).toBeTruthy();
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([url]) => String(url).includes('status=COMPLETED') && String(url).includes('studentId=student-a') && String(url).includes('billingMonth=2026-07'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(window.location.search).toContain('page=2'));
  });

  it('clears protected detail on a 401 response', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
      if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: students }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({}), { status: 401 }));
    }));
    window.history.pushState({}, '', '/invoices/unknown');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Chi tiết Hóa đơn' })).toBeNull();
  });

  it('keeps completed History records out of the screen when their student is no longer active', async () => {
    const completed = invoice('done-2', 'Bé An', '2026-07', 'TRANSFER', 'COMPLETED');
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
      if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: [students[1]] }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ data: [completed], meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 } }), { status: 200 }));
    }));
    window.history.pushState({}, '', '/history');
    render(<App />);
    expect(await screen.findByText('Chưa có Hóa đơn đã hoàn tất.')).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('normalizes invalid History query values before using the API', async () => {
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
      if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: students }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ data: [], meta: { page: 1, pageSize: 20, total: 0, pageCount: 1 } }), { status: 200 }));
    }));
    window.history.pushState({}, '', '/history?studentId=revoked&billingMonth=bad&page=1.5');
    render(<App />);
    await screen.findByRole('heading', { name: 'Lịch sử thanh toán' });
    await waitFor(() => expect(window.location.search).toBe(''));
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.some(([url]) => String(url).includes('page=1') && !String(url).includes('studentId=') && !String(url).includes('billingMonth='))).toBe(true);
  });
});

describe('Parent payment sheet', () => {
  const payment = { data: { id: 'a-1', student: { id: 'student-a', name: 'Bé An' }, billingMonth: '2026-08', total: 1500000, bankCode: 'VCB', accountNumber: '123456789', accountHolderName: 'NGUYEN VAN A', transferContent: 'ANH HOA' }, vietQr: '000201010212' };
  function mockPayment(paymentResponse: Response = new Response(JSON.stringify(payment), { status: 200 })): void {
    vi.stubGlobal('fetch', vi.fn((input: string) => {
      if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
      if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: students }), { status: 200 }));
      if (input.includes('/payment')) return Promise.resolve(paymentResponse);
      return Promise.resolve(new Response(JSON.stringify({ data: [invoice('a-1', 'Bé An', '2026-08')], meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 } }), { status: 200 }));
    }));
  }
  it('keeps the sheet closed while eligibility is pending, then opens it only after JSON succeeds', async () => {
    let resolvePayment: ((response: Response) => void) | undefined;
    mockPayment();
    (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: string) => {
      if (input.includes('/payment')) return new Promise<Response>((resolve) => { resolvePayment = resolve; });
      if (input.endsWith('/parent/me')) return Promise.resolve(new Response(JSON.stringify({ data: parent }), { status: 200 }));
      if (input.endsWith('/parent/students')) return Promise.resolve(new Response(JSON.stringify({ data: students }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ data: [invoice('a-1', 'Bé An', '2026-08')], meta: { page: 1, pageSize: 100, total: 1, pageCount: 1 } }), { status: 200 }));
    });
    window.history.pushState({}, '', '/'); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển tiền' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đang kiểm tra hướng dẫn...' })).toHaveProperty('disabled', true);
    resolvePayment?.(new Response(JSON.stringify(payment), { status: 200 }));
    expect(await screen.findByRole('dialog', { name: 'Hướng dẫn chuyển tiền' })).toBeTruthy();
  });
  it('keeps a transient JSON eligibility error inline and retries without treating it as denial', async () => {
    mockPayment(new Response(JSON.stringify({}), { status: 500 })); window.history.pushState({}, '', '/'); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển tiền' }));
    expect(await screen.findByText('Không thể tải hướng dẫn chuyển tiền. Vui lòng thử lại.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response(JSON.stringify(payment), { status: 200 }));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại hướng dẫn chuyển tiền' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
  it('loads only the server payment payload, renders QR and five independent copy controls', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined); Object.assign(navigator, { clipboard: { writeText } }); mockPayment(); window.history.pushState({}, '', '/'); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển tiền' }));
    expect(await screen.findByRole('dialog', { name: 'Hướng dẫn chuyển tiền' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mã QR chuyển khoản cho Bé An, 1.500.000 đồng' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Sao chép/ })).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Sao chép Số tài khoản' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('123456789'));
    expect(screen.getByText('Đang chờ nhà trường xác nhận')).toBeTruthy();
    expect(screen.queryByText(/xác nhận đã nhận/i)).toBeNull();
  });
  it('downloads PNG with the required Accept header and keeps the sheet open after a retryable failure', async () => {
    mockPayment(); vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })); const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined); window.history.pushState({}, '', '/'); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển tiền' })); await screen.findByRole('button', { name: 'Tải mã QR' });
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 })); fireEvent.click(screen.getByRole('button', { name: 'Tải mã QR' }));
    expect(await screen.findByText('Không thể tải mã QR. Vui lòng thử lại.')).toBeTruthy(); expect(screen.getByRole('dialog')).toBeTruthy();
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response('png', { status: 200, headers: { 'content-disposition': 'attachment; filename="anh-hoa-a-1.png"' } })); fireEvent.click(screen.getByRole('button', { name: 'Tải mã QR' }));
    await waitFor(() => expect(click).toHaveBeenCalled()); const request = (fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1); expect(request?.[1]?.headers).toEqual({ Accept: 'image/png' });
  });
  it('disables duplicate PNG downloads and clears the sheet for a denied PNG response', async () => {
    let resolvePng: ((response: Response) => void) | undefined;
    mockPayment(); vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })); window.history.pushState({}, '', '/'); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển tiền' })); await screen.findByRole('dialog');
    (fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolvePng = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Tải mã QR' }));
    expect(screen.getByRole('button', { name: 'Đang tải mã QR...' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Đang tải mã QR...' }));
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([url]) => String(url).includes('/payment'))).toHaveLength(2);
    resolvePng?.(new Response(JSON.stringify({}), { status: 403 }));
    expect(await screen.findByText('Hướng dẫn chuyển tiền không còn khả dụng')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('returns focus to the opener on Escape and clears protected state on payment 401', async () => {
    mockPayment(); window.history.pushState({}, '', '/'); render(<App />); const opener = await screen.findByRole('button', { name: 'Chuyển tiền' }); fireEvent.click(opener); await screen.findByRole('dialog'); fireEvent.keyDown(window, { key: 'Escape' }); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); expect(document.activeElement).toBe(opener);
    mockPayment(new Response(JSON.stringify({}), { status: 401 })); fireEvent.click(opener); expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
