import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParentShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); document.cookie = 'parent_csrf=; Max-Age=0'; window.history.replaceState(null, '', '/'); });

function parentResponse(session: object, input: RequestInfo | URL) {
  const path = String(input);
  if (path.includes('/obligations')) { const obligation = { id: 'invoice-a', studentId: 'student-a', obligationCode: 'OBL-202609-000001', period: '2026-09', issuedTotal: '2100000', vatTotal: '100000', actualReceipt: '0', outcome: null, outstanding: '2100000', state: 'ISSUED', effectiveAt: '2026-09-27T00:00:00.000Z', paymentInstruction: { receivingBank: 'Ngân hàng A', accountNumber: '123', accountHolderName: 'Trường A', transferContent: 'BE AN' } }; return Promise.resolve(new Response(JSON.stringify({ data: /obligations\/[^/]+$/.test(path) ? obligation : [obligation] }))); }
  if (path.includes('/inbox')) return Promise.resolve(new Response(JSON.stringify({ data: [], meta: { unreadCount: 0 } })));
  if (path.includes('/attendance?')) return Promise.resolve(new Response(JSON.stringify({ data: [{ studentId: 'student-a', studentDisplayName: 'Bé An', date: '2026-09-27', status: 'NOT_RECORDED', updatedAt: null }] })));
  if (path.includes('/daily-journal?')) return Promise.resolve(new Response(JSON.stringify({ data: null })));
  if (path.includes('/class-note?')) return Promise.resolve(new Response(JSON.stringify({ data: null })));
  if (path.endsWith('/messages/summary')) return Promise.resolve(new Response(JSON.stringify({ data: [] })));
  if (path.endsWith('/messages/read')) return Promise.resolve(new Response(JSON.stringify({ data: { ok: true } })));
  if (path.endsWith('/messages')) return Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', canSend: true, className: 'Mầm', messages: [] } })));
  return Promise.resolve(new Response(JSON.stringify({ data: session })));
}
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>((done) => { resolve = done; }), resolve }; }

describe('ParentShell', () => {
  it('keeps protected content hidden after a 401 startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<ParentShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Cổng phụ huynh đang được khởi tạo.')).toBeNull();
  });

  it('enters a single authorized School directly and keeps all of its children together', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />);
    expect(await screen.findByRole('heading', { name: 'Hôm nay của các con' })).toBeTruthy();
    expect(screen.getByText('Trường A')).toBeTruthy();
    expect(screen.getByText('Bé An')).toBeTruthy();
    expect(screen.getByText('Bé Bình')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull();
  });
  it('provides a phone-only contact sheet and retains the field value when validation fails', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    document.cookie = 'parent_csrf=csrf';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input, init) => { const path = String(input); if (path.endsWith('/profile')) return Promise.resolve(new Response(JSON.stringify({ data: { phone: '090 000 0000' } }))); if (path.endsWith('/profile/phone') && (init as RequestInit).method === 'PATCH') return Promise.resolve(new Response(JSON.stringify({ fieldErrors: { phone: 'Số điện thoại không hợp lệ.' } }), { status: 400 })); return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByRole('button', { name: 'Liên hệ' }); fireEvent.click(screen.getByRole('button', { name: 'Liên hệ' })); const input = await screen.findByLabelText('Số điện thoại'); fireEvent.change(input, { target: { value: 'bad' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu số điện thoại' })); const summary = await screen.findByRole('alert'); expect(summary.textContent).toBe('Số điện thoại không hợp lệ.'); expect(document.activeElement).toBe(summary); expect((input as HTMLInputElement).value).toBe('bad');
  });
  it('keeps an uncertain phone Operation locked across Today, Inbox, and contact navigation', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    document.cookie = 'parent_csrf=csrf'; let mutations = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input, init) => { const path = String(input); if (path.endsWith('/profile')) return Promise.resolve(new Response(JSON.stringify({ data: { phone: '090 000 0000' } }))); if (path.endsWith('/profile/phone') && (init as RequestInit).method === 'PATCH') { mutations += 1; return Promise.resolve(new Response(null, { status: 504 })); } if (path.includes('/operations/')) return Promise.resolve(new Response(JSON.stringify({ data: { id: 'operation', status: 'PENDING', outcome: null } }))); return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByRole('heading', { name: 'Chọn trường để xem' }); fireEvent.click(screen.getByRole('button', { name: /Trường A/ })); await screen.findByRole('button', { name: 'Liên hệ' }); fireEvent.click(screen.getByRole('button', { name: 'Liên hệ' })); const input = screen.getByLabelText('Số điện thoại'); fireEvent.change(input, { target: { value: '090 123 4567' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu số điện thoại' })); await screen.findByRole('button', { name: 'Đang đối soát thao tác...' }); fireEvent.click(screen.getByRole('button', { name: 'Thông báo' })); expect((screen.getByRole('button', { name: 'Đang đối soát thao tác...' }) as HTMLButtonElement).disabled).toBe(true); expect((screen.getByRole('button', { name: 'Đổi trường' }) as HTMLButtonElement).disabled).toBe(true); fireEvent.click(screen.getByRole('button', { name: 'Hôm nay' })); fireEvent.click(screen.getByRole('button', { name: 'Liên hệ' })); expect((screen.getByRole('button', { name: 'Đang đối soát thao tác...' }) as HTMLButtonElement).disabled).toBe(true); expect(mutations).toBe(1);
  });

  it('renders the neutral attendance label from the server and loads no journal media before an explicit action', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Trường chưa ghi nhận');
    fireEvent.click(screen.getByRole('button', { name: /Bé An/ }));
    await screen.findByRole('heading', { name: 'Bé An' });
    expect(screen.getByText('Trường chưa ghi nhận')).toBeTruthy();
    expect(fetch.mock.calls.some(([input]) => String(input).includes('/daily-journal-media/'))).toBe(false);
  });

  it('renders the five-item mobile navigation including messages and opens only the existing contact sheet', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />);
    const navigation = await screen.findByRole('navigation', { name: 'Điều hướng phụ huynh' });
    expect(navigation.querySelectorAll('button')).toHaveLength(5);
    expect(navigation.textContent).toContain('Tin nhắn');
    expect(screen.getAllByRole('button', { name: 'Hôm nay' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Liên hệ' }).at(-1)!);
    expect(await screen.findByRole('heading', { name: 'Thông tin liên hệ' })).toBeTruthy();
  });

  it('shows the class daily note for the selected child and day, loading its image only on request', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const note = { className: 'Mầm', noteDate: '2026-09-27', text: 'Hôm nay lớp đi dã ngoại.\nNhớ mang mũ cho bé.', updatedAt: '2026-09-27T09:00:00.000Z', media: [{ id: 'note-media', contentType: 'image/jpeg' }] };
    const fetch = vi.fn().mockImplementation((input) => {
      const path = String(input);
      if (path.includes('/class-note?')) return Promise.resolve(new Response(JSON.stringify({ data: note })));
      if (path.includes('/class-note-media/')) return Promise.resolve(new Response(new Blob(['image'], { type: 'image/jpeg' })));
      return parentResponse(session, input);
    });
    vi.stubGlobal('fetch', fetch);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:note'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(<ParentShell />);
    fireEvent.click(await screen.findByRole('button', { name: /Bé An/ }));
    const heading = await screen.findByRole('heading', { name: 'Bản tin lớp Mầm' });
    const text = heading.parentElement!.querySelector('.class-note-text')!;
    expect(text.textContent).toBe('Hôm nay lớp đi dã ngoại.\nNhớ mang mũ cho bé.');
    expect(fetch.mock.calls.some(([input]) => /students\/student-a\/class-note\?noteDate=\d{4}-\d{2}-\d{2}$/.test(String(input)))).toBe(true);
    expect(fetch.mock.calls.some(([input]) => String(input).includes('/class-note-media/'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh bản tin lớp' }));
    expect(((await screen.findByAltText('Ảnh bản tin lớp trong ngày')) as HTMLImageElement).src).toBe('blob:note');
    expect(fetch.mock.calls.some(([input]) => String(input).endsWith('/school-a/class-note-media/note-media'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại Hôm nay' }));
    expect(revoke).toHaveBeenCalledWith('blob:note');
    create.mockRestore(); revoke.mockRestore();
  });

  it('hides the class note card when the class has no note for the day', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />);
    fireEvent.click(await screen.findByRole('button', { name: /Bé An/ }));
    await screen.findByText('Chưa có nhận xét trong ngày này.');
    expect(screen.queryByRole('heading', { name: /Bản tin lớp/ })).toBeNull();
  });

  it('shows the message unread badge, renders the thread, marks it read and sends with idempotency headers', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    document.cookie = 'parent_csrf=csrf';
    let unreadCount = 2;
    const messages = [
      { id: 'm1', senderType: 'TEACHER', senderLabel: 'Giáo viên lớp Mầm', mine: false, body: 'Hôm nay bé ăn ngoan.', createdAt: '2026-09-27T02:00:00.000Z' },
      { id: 'm2', senderType: 'PARENT', senderLabel: 'Mẹ', mine: true, body: 'Cảm ơn cô.', createdAt: '2026-09-27T03:00:00.000Z' },
    ];
    const fetch = vi.fn().mockImplementation((input, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/messages/summary')) return Promise.resolve(new Response(JSON.stringify({ data: [{ studentId: 'student-a', unreadCount }] })));
      if (path.endsWith('/messages/read')) { unreadCount = 0; return Promise.resolve(new Response(JSON.stringify({ data: { ok: true } }))); }
      if (path.endsWith('/students/student-a/messages') && init?.method === 'POST') {
        messages.push({ id: 'm3', senderType: 'PARENT', senderLabel: 'Mẹ', mine: true, body: JSON.parse(String(init.body)).body, createdAt: '2026-09-27T04:00:00.000Z' });
        return Promise.resolve(new Response(JSON.stringify({ data: { id: 'operation', status: 'COMPLETED', outcome: { id: 'm3' } } })));
      }
      if (path.endsWith('/students/student-a/messages')) return Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', canSend: true, className: 'Mầm', messages: [...messages] } })));
      return parentResponse(session, input);
    });
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    const link = await screen.findByRole('button', { name: /^Tin nhắn/ });
    await waitFor(() => expect(link.textContent).toContain('2'));
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { name: 'Tin nhắn' })).toBeTruthy();
    expect(window.location.pathname).toBe('/messages');
    expect(await screen.findByText('Hôm nay bé ăn ngoan.')).toBeTruthy();
    expect(screen.getByText(/Giáo viên lớp Mầm ·/)).toBeTruthy();
    expect(screen.getByText('Cảm ơn cô.').closest('.chat-message')!.className).toContain('mine');
    expect(screen.getByText('Hôm nay bé ăn ngoan.').closest('.chat-message')!.className).not.toContain('mine');
    await waitFor(() => expect(fetch.mock.calls.some(([input, init]) => String(input).endsWith('/students/student-a/messages/read') && (init as RequestInit).method === 'POST')).toBe(true));
    await waitFor(() => expect(link.textContent).not.toContain('2'));
    const draft = screen.getByLabelText('Tin nhắn gửi giáo viên');
    fireEvent.change(draft, { target: { value: 'Chiều nay bố đón bé.' } });
    fireEvent.keyDown(draft, { key: 'Enter' });
    expect(await screen.findByText('Chiều nay bố đón bé.')).toBeTruthy();
    const send = fetch.mock.calls.find(([input, init]) => String(input).endsWith('/students/student-a/messages') && (init as RequestInit | undefined)?.method === 'POST')!;
    const headers = (send[1] as RequestInit).headers as Record<string, string>;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(headers['idempotency-key']).toMatch(uuid);
    expect(headers['x-operation-id']).toMatch(uuid);
    expect(headers['x-csrf-token']).toBe('csrf');
    expect(headers['content-type']).toBe('application/json');
    expect(JSON.parse(String((send[1] as RequestInit).body))).toEqual({ body: 'Chiều nay bố đón bé.' });
    await waitFor(() => expect((draft as HTMLTextAreaElement).value).toBe(''));
  });

  it('keeps an uncertain message send locked while reconciling its Operation before allowing another send', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    document.cookie = 'parent_csrf=csrf';
    window.history.replaceState(null, '', '/messages');
    let sends = 0; let completed = false; let reconciledOperation = '';
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/students/student-a/messages') && init?.method === 'POST') { sends += 1; reconciledOperation = (init.headers as Record<string, string>)['x-operation-id']!; return Promise.resolve(new Response(null, { status: 504 })); }
      if (path.includes('/operations/')) { expect(path.endsWith(`/operations/${reconciledOperation}`)).toBe(true); return Promise.resolve(new Response(JSON.stringify({ data: { id: reconciledOperation, status: completed ? 'COMPLETED' : 'PENDING', outcome: null } }))); }
      return parentResponse(session, input);
    }));
    render(<ParentShell />);
    const draft = await screen.findByLabelText('Tin nhắn gửi giáo viên');
    await screen.findByText(/Chưa có tin nhắn/);
    fireEvent.change(draft, { target: { value: 'Bé hơi sốt nhẹ.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(await screen.findByText('Đang kiểm tra kết quả với hệ thống...')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Gửi' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(draft, { key: 'Enter' });
    expect(sends).toBe(1);
    completed = true;
    await waitFor(() => expect(screen.queryByText('Đang kiểm tra kết quả với hệ thống...')).toBeNull(), { timeout: 3000 });
    expect((draft as HTMLTextAreaElement).value).toBe('');
    expect(sends).toBe(1);
  });

  it('shows a quiet note instead of the composer when the child cannot message a class', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    window.history.replaceState(null, '', '/messages');
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).endsWith('/students/student-a/messages') ? Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', canSend: false, className: null, messages: [] } }))) : parentResponse(session, input)));
    render(<ParentShell />);
    expect(await screen.findByText(/chưa thể gửi tin nhắn mới/)).toBeTruthy();
    expect(screen.queryByLabelText('Tin nhắn gửi giáo viên')).toBeNull();
  });

  it('shows the read-only obligation snapshot with distinct issued and outstanding values', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />);
    await screen.findByRole('button', { name: 'Khoản cần thanh toán' });
    fireEvent.click(screen.getByRole('button', { name: 'Khoản cần thanh toán' }));
    await screen.findByText('OBL-202609-000001');
    fireEvent.click(screen.getByRole('button', { name: /OBL-202609-000001/ }));
    await screen.findByText('Tổng tiền khi phát hành');
    expect(screen.getByText('Còn phải thanh toán')).toBeTruthy();
    expect(screen.getByText('Đã gồm thuế GTGT 100.000 đ')).toBeTruthy();
    expect(screen.queryByText(/Tôi đã thanh toán|VietQR|Sao chép/)).toBeNull();
  });

  it('shows the run period label of an obligation and falls back to the month when the label is absent', async () => {
    window.history.replaceState(null, '', '/obligations');
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trung tâm A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const base = { studentId: 'student-a', issuedTotal: '3600000', actualReceipt: '0', outcome: null, outstanding: '3600000', state: 'ISSUED', effectiveAt: '2026-10-01T00:00:00.000Z', paymentInstruction: { receivingBank: 'Ngân hàng A', accountNumber: '123', accountHolderName: 'Trung tâm A', transferContent: 'BE AN' } };
    const labelled = { ...base, id: 'invoice-u', obligationCode: 'OBL-202609-000050', period: '2026-09', periodLabel: 'Starters A · Unit 3' };
    const legacy = { ...base, id: 'invoice-m', obligationCode: 'OBL-202608-000007', period: '2026-08' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).includes('/obligations') ? Promise.resolve(new Response(JSON.stringify({ data: String(input).endsWith('/obligations') ? [labelled, legacy] : labelled }))) : parentResponse(session, input)));
    render(<ParentShell />);
    const card = await screen.findByRole('button', { name: /OBL-202609-000050/ });
    expect(card.textContent).toContain('Starters A · Unit 3'); expect(card.textContent).not.toContain('2026-09');
    expect(screen.getByRole('button', { name: /OBL-202608-000007/ }).textContent).toContain('2026-08');
    fireEvent.click(card);
    expect((await screen.findByText('Kỳ thu')).nextElementSibling?.textContent).toBe('Starters A · Unit 3');
  });

  it('loads and preserves the obligation list for an initial or refreshed obligations route', async () => {
    window.history.replaceState(null, '', '/obligations');
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    const first = render(<ParentShell />);
    await screen.findByRole('heading', { name: 'Khoản cần thanh toán' });
    expect(screen.getByText('OBL-202609-000001')).toBeTruthy();
    expect(fetch.mock.calls.some(([input]) => String(input).endsWith('/obligations'))).toBe(true);
    first.unmount();
    render(<ParentShell />);
    await screen.findByRole('heading', { name: 'Khoản cần thanh toán' });
    expect(screen.getByText('OBL-202609-000001')).toBeTruthy();
    expect(window.location.pathname).toBe('/obligations');
  });

  it('clears obligation and payment snapshot state when the detail request is denied', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    let denyDetail = false;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (denyDetail && /obligations\/invoice-a$/.test(String(input))) return Promise.resolve(new Response(null, { status: 403 }));
      return parentResponse(session, input);
    }));
    render(<ParentShell />);
    await screen.findByRole('button', { name: 'Khoản cần thanh toán' });
    fireEvent.click(screen.getByRole('button', { name: 'Khoản cần thanh toán' }));
    await screen.findByText('OBL-202609-000001');
    denyDetail = true;
    fireEvent.click(screen.getByRole('button', { name: /OBL-202609-000001/ }));
    const fallback = await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    expect(document.activeElement).toBe(fallback);
    expect(screen.queryByText('OBL-202609-000001')).toBeNull();
    expect(screen.queryByText('Ngân hàng A')).toBeNull();
  });

  it('ignores a stale denied obligation detail after a newer detail succeeds', async () => {
    const first = deferred<Response>(); const second = deferred<Response>();
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      const path = String(input);
      if (path.endsWith('/obligations')) return Promise.resolve(new Response(JSON.stringify({ data: [
        { id: 'invoice-a', studentId: 'student-a', obligationCode: 'OBL-202609-000001', period: '2026-09', issuedTotal: '100', actualReceipt: '0', outcome: null, outstanding: '100', state: 'ISSUED', effectiveAt: '2026-09-27T00:00:00.000Z', paymentInstruction: { receivingBank: 'A', accountNumber: '1', accountHolderName: 'A', transferContent: 'A' } },
        { id: 'invoice-b', studentId: 'student-a', obligationCode: 'OBL-202610-000001', period: '2026-10', issuedTotal: '200', actualReceipt: '0', outcome: null, outstanding: '200', state: 'ISSUED', effectiveAt: '2026-10-01T00:00:00.000Z', paymentInstruction: { receivingBank: 'B', accountNumber: '2', accountHolderName: 'B', transferContent: 'B' } },
      ] }))); if (path.endsWith('/obligations/invoice-a')) return first.promise; if (path.endsWith('/obligations/invoice-b')) return second.promise; return parentResponse(session, input);
    }));
    render(<ParentShell />); await screen.findByRole('button', { name: 'Khoản cần thanh toán' }); fireEvent.click(screen.getByRole('button', { name: 'Khoản cần thanh toán' })); await screen.findByText('OBL-202610-000001'); fireEvent.click(screen.getByRole('button', { name: /OBL-202609-000001/ })); await screen.findByRole('button', { name: 'Quay lại danh sách' }); fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' })); fireEvent.click(screen.getByRole('button', { name: /OBL-202610-000001/ }));
    second.resolve(new Response(JSON.stringify({ data: { id: 'invoice-b', studentId: 'student-a', obligationCode: 'OBL-202610-000001', period: '2026-10', issuedTotal: '200', actualReceipt: '0', outcome: null, outstanding: '200', state: 'ISSUED', effectiveAt: '2026-10-01T00:00:00.000Z', paymentInstruction: { receivingBank: 'Ngân hàng B', accountNumber: '2', accountHolderName: 'Chủ B', transferContent: 'Nội dung B' } } }))); await screen.findByText('Ngân hàng nhận'); expect(screen.getByText('Ngân hàng B')).toBeTruthy(); first.resolve(new Response(null, { status: 403 })); await new Promise<void>((resolve) => queueMicrotask(resolve)); expect(screen.getByText('OBL-202610-000001')).toBeTruthy(); expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull();
  });

  it('shows a refund owed by the School without transfer instructions and names the leave deduction', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const item = { id: 'invoice-r', studentId: 'student-a', channel: 'PERSONAL', obligationCode: 'OBL-202609-000312', period: '2026-09', issuedTotal: '-448000', vatTotal: '0', deductionTotal: '448000', actualReceipt: '0', outcome: null, outstanding: '-448000', state: 'ISSUED', effectiveAt: '2026-09-02T00:00:00.000Z', paymentInstruction: { receivingBank: 'Ngân hàng A', accountNumber: '1', accountHolderName: 'A', transferContent: 'Be An' } };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).endsWith('/obligations/invoice-r') ? Promise.resolve(new Response(JSON.stringify({ data: item }))) : String(input).endsWith('/obligations') ? Promise.resolve(new Response(JSON.stringify({ data: [item] }))) : parentResponse(session, input)));
    render(<ParentShell />); await screen.findByRole('button', { name: 'Khoản cần thanh toán' }); fireEvent.click(screen.getByRole('button', { name: 'Khoản cần thanh toán' }));
    const card = await screen.findByRole('button', { name: /OBL-202609-000312/ });
    expect(card.textContent).toContain('Trường hoàn lại 448.000');
    fireEvent.click(card);
    expect(await screen.findByRole('heading', { name: 'Trường hoàn lại cho phụ huynh' })).toBeTruthy();
    expect(screen.getByText('Đã bớt 448.000 đ cho ngày nghỉ có phép')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Thông tin chuyển khoản' })).toBeNull();
    expect(screen.queryByText('Còn phải thanh toán')).toBeNull();
  });

  it('shows a negative monthly obligation as credit deducted next month', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const item = { id: 'invoice-c', studentId: 'student-a', channel: 'PERSONAL', obligationCode: 'OBL-202610-000040', period: '2026-10', issuedTotal: '-35000', vatTotal: '0', deductionTotal: '105000', carriedCredit: '35000', actualReceipt: '0', outcome: 'OVERPAYMENT', outstanding: '0', state: 'CLOSED', effectiveAt: '2026-10-02T00:00:00.000Z', paymentInstruction: null };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).endsWith('/obligations/invoice-c') ? Promise.resolve(new Response(JSON.stringify({ data: item }))) : String(input).endsWith('/obligations') ? Promise.resolve(new Response(JSON.stringify({ data: [item] }))) : parentResponse(session, input)));
    render(<ParentShell />); await screen.findByRole('button', { name: 'Khoản cần thanh toán' }); fireEvent.click(screen.getByRole('button', { name: 'Khoản cần thanh toán' }));
    fireEvent.click(await screen.findByRole('button', { name: /OBL-202610-000040/ }));
    expect(await screen.findByText('Tiền thừa trừ vào tháng sau')).toBeTruthy();
    expect(screen.queryByText('Trường hoàn lại')).toBeNull();
  });

  it('keeps the obligation list when a detail request resolves after returning', async () => {
    const detail = deferred<Response>();
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const item = { id: 'invoice-a', studentId: 'student-a', obligationCode: 'OBL-202609-000001', period: '2026-09', issuedTotal: '100', actualReceipt: '0', outcome: null, outstanding: '100', state: 'ISSUED', effectiveAt: '2026-09-27T00:00:00.000Z', paymentInstruction: { receivingBank: 'Ngân hàng A', accountNumber: '123', accountHolderName: 'Trường A', transferContent: 'BE AN' } };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).endsWith('/obligations/invoice-a') ? detail.promise : String(input).endsWith('/obligations') ? Promise.resolve(new Response(JSON.stringify({ data: [item] }))) : parentResponse(session, input)));
    render(<ParentShell />); await screen.findByRole('button', { name: 'Khoản cần thanh toán' }); fireEvent.click(screen.getByRole('button', { name: 'Khoản cần thanh toán' })); await screen.findByText(item.obligationCode); fireEvent.click(screen.getByRole('button', { name: new RegExp(item.obligationCode) })); await screen.findByRole('button', { name: 'Quay lại danh sách' }); fireEvent.click(screen.getByRole('button', { name: 'Quay lại danh sách' })); detail.resolve(new Response(JSON.stringify({ data: item }))); await new Promise<void>((resolve) => queueMicrotask(resolve)); expect(screen.getByText(item.obligationCode)).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Quay lại danh sách' })).toBeNull(); expect(screen.queryByText('Thông tin chuyển khoản')).toBeNull();
  });

  it('clears child detail and focuses the safe fallback when its journal endpoint is denied', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    let denied = false;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (String(input).includes('/daily-journal?') && denied) return Promise.resolve(new Response(null, { status: 403 }));
      return parentResponse(session, input);
    }));
    render(<ParentShell />);
    await screen.findByText('Bé An');
    await screen.findByText('Trường chưa ghi nhận');
    denied = true;
    fireEvent.click(screen.getByRole('button', { name: /Bé An/ }));
    const fallback = await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    expect(document.activeElement).toBe(fallback);
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('aborts concurrent child reads before another child response can commit after denial', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    const first = deferred<Response>(); const second = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.includes('/auth/session')) return parentResponse(session, input); if (path.includes('student-a/attendance')) return first.promise; if (path.includes('student-b/attendance')) return second.promise; return Promise.resolve(new Response(JSON.stringify({ data: null }))); }));
    render(<ParentShell />);
    first.resolve(new Response(null, { status: 403 }));
    const fallback = await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    second.resolve(new Response(JSON.stringify({ data: [{ studentId: 'student-b', studentDisplayName: 'Bé Bình', date: '2026-09-27', status: 'PRESENT', updatedAt: null }] })));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(document.activeElement).toBe(fallback);
    expect(screen.queryByText('Bé Bình')).toBeNull();
  });

  it('shows only distinct authorized Schools in the chooser and clears it before entering a selected School', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />);
    await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    expect(screen.getByRole('button', { name: /Trường A/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Trường B/ })).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(screen.queryByText('Bé Bình')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Trường B/ }));
    expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull();
    const destination = await screen.findByRole('heading', { name: 'Hôm nay của các con' });
    expect(document.activeElement).toBe(destination);
    expect(screen.getByText('Trường B')).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('clears protected content before a foreground revalidation denies the session', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    let sessionCalls = 0; const fetch = vi.fn().mockImplementation((input) => { if (String(input).includes('/auth/session')) return ++sessionCalls === 1 ? parentResponse(session, input) : new Response(null, { status: 401 }); return parentResponse(session, input); });
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    const fallback = await screen.findByRole('heading', { name: 'Phụ huynh' });
    expect(document.activeElement).toBe(fallback);
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('returns to the chooser when foreground refresh removes the selected School but leaves one alternative', async () => {
    const multiSchool = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    const alternativeOnly = { ...multiSchool, schools: [multiSchool.schools[1]!] };
    let sessionCalls = 0; const fetch = vi.fn().mockImplementation((input) => { if (String(input).includes('/auth/session')) return parentResponse(++sessionCalls < 3 ? multiSchool : alternativeOnly, input); return parentResponse(multiSchool, input); });
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    fireEvent.click(screen.getByRole('button', { name: /Trường A/ }));
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(screen.queryByText('Bé Bình')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Hôm nay của các con' })).toBeNull();
  });

  it('coalesces focus and visibility foreground events into one session refresh', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    fireEvent(document, new Event('visibilitychange'));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(fetch.mock.calls.filter(([input]) => String(input).includes('/auth/session'))).toHaveLength(2);
  });

  it('does not restore a workspace when a queued foreground refresh races with logout', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(screen.getByRole('heading', { name: 'Phụ huynh' })).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(fetch.mock.calls.filter(([input]) => String(input).includes('/auth/session'))).toHaveLength(1);
  });

  it('does not run a queued foreground refresh after unmount', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    const view = render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    view.unmount();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(fetch.mock.calls.filter(([input]) => String(input).includes('/auth/session'))).toHaveLength(1);
  });

  it('resolves a direct child/day URL through the matching inbox event before rendering detail', async () => {
    window.history.replaceState(null, '', '/children/student-a/days/2026-09-27'); document.cookie = 'parent_csrf=csrf';
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => { const path = String(input); if (path.includes('/inbox/') && path.endsWith('/open')) return Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', date: '2026-09-27' } }))); if (path.endsWith('/inbox')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); return parentResponse(session, input); }); vi.stubGlobal('fetch', fetch);
    render(<ParentShell />); await screen.findByRole('heading', { name: 'Bé An' }); await screen.findByRole('heading', { name: 'Lịch sử điểm danh' });
    expect(fetch.mock.calls.some(([input, init]) => String(input).endsWith('/inbox/event-a/open') && (init as RequestInit).method === 'POST')).toBe(true);
    expect(window.location.pathname).toBe('/children/student-a/days/2026-09-27');
  });

  it('does not fetch protected child data before a direct URL inbox resolver succeeds', async () => {
    window.history.replaceState(null, '', '/children/student-a/days/2026-09-27'); document.cookie = 'parent_csrf=csrf'; const opened = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); if (path.endsWith('/inbox/event-a/open')) return opened.promise; return parentResponse(session, input); }); vi.stubGlobal('fetch', fetch);
    render(<ParentShell />); await screen.findByText('Đang tải cập nhật...'); expect(fetch.mock.calls.some(([input]) => String(input).includes('/students/student-a/attendance'))).toBe(false); opened.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', date: '2026-09-27' } }))); await screen.findByRole('heading', { name: 'Bé An' }); expect(fetch.mock.calls.some(([input]) => String(input).includes('/students/student-a/attendance'))).toBe(true);
  });

  it('opens an authorized Today child without an inbox event and keeps child detail out of the URL', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />); await screen.findByRole('button', { name: /Bé AnTrường/ }); fireEvent.click(screen.getByRole('button', { name: /Bé AnTrường/ })); await screen.findByRole('heading', { name: 'Bé An' }); expect(window.location.pathname).toBe('/');
  });

  it('loads attendance history when a Today child is opened before its initial attendance request resolves', async () => {
    const attendance = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).includes('/students/student-a/attendance') ? attendance.promise : parentResponse(session, input)));
    render(<ParentShell />); await screen.findByRole('button', { name: /Bé AnTrường/ }); fireEvent.click(screen.getByRole('button', { name: /Bé AnTrường/ })); await screen.findByRole('heading', { name: 'Bé An' }); attendance.resolve(new Response(JSON.stringify({ data: [{ studentId: 'student-a', studentDisplayName: 'Bé An', date: '2026-09-27', status: 'PRESENT', updatedAt: '2026-09-27T01:00:00.000Z' }] }))); await screen.findByText('2026-09-27');
  });

  it('clears general loading after replacement attendance resolves and returns to Today', async () => {
    const attendance = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).includes('/students/student-a/attendance') ? attendance.promise : parentResponse(session, input)));
    render(<ParentShell />); await screen.findByRole('button', { name: /Bé AnTrường/ }); fireEvent.click(screen.getByRole('button', { name: /Bé AnTrường/ })); await screen.findByRole('heading', { name: 'Bé An' }); attendance.resolve(new Response(JSON.stringify({ data: [{ studentId: 'student-a', studentDisplayName: 'Bé An', date: '2026-09-27', status: 'PRESENT', updatedAt: '2026-09-27T01:00:00.000Z' }] }))); await screen.findByText('2026-09-27'); fireEvent.click(screen.getByRole('button', { name: 'Quay lại Hôm nay' })); await screen.findByRole('button', { name: /Bé AnĐã ghi nhận có mặt/ }); expect(screen.queryByText('Đang tải cập nhật...')).toBeNull();
  });

  it('keeps the workspace inbox load alive when Inbox is selected before initial loading completes', async () => {
    const inbox = deferred<Response>(); const attendance = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return inbox.promise; if (path.includes('/students/student-a/attendance')) return attendance.promise; return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByRole('button', { name: 'Thông báo' }); fireEvent.click(screen.getByRole('button', { name: 'Thông báo' })); await screen.findByRole('heading', { name: 'Thông báo' }); inbox.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); attendance.resolve(new Response(JSON.stringify({ data: [] }))); await screen.findByRole('button', { name: /Bé An, Đã ghi nhận/ }); expect(screen.queryByText('Đang tải cập nhật...')).toBeNull();
  });

  it('keeps the pending workspace inbox result after ordinary child selection and shows it on Inbox', async () => {
    const inbox = deferred<Response>(); const initialAttendance = deferred<Response>(); const replacement = deferred<Response>(); let attendanceCalls = 0; const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return inbox.promise; if (path.includes('/students/student-a/attendance')) return ++attendanceCalls === 1 ? initialAttendance.promise : replacement.promise; return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByRole('button', { name: /Bé AnTrường/ }); fireEvent.click(screen.getByRole('button', { name: /Bé AnTrường/ })); await screen.findByRole('heading', { name: 'Bé An' }); fireEvent.click(screen.getByRole('button', { name: /Thông báo/ })); inbox.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); replacement.resolve(new Response(JSON.stringify({ data: [] }))); initialAttendance.resolve(new Response(JSON.stringify({ data: [] }))); await screen.findByRole('button', { name: /Bé An, Đã ghi nhận/ });
  });

  it('falls back safely when direct or popstate child/date has no authorized inbox event', async () => {
    window.history.replaceState(null, '', '/children/foreign/days/2026-09-27'); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />); const fallback = await screen.findByRole('heading', { name: 'Chọn trường để xem' }); expect(document.activeElement).toBe(fallback); expect(window.location.pathname).toBe('/'); fireEvent.click(screen.getByRole('button', { name: /Trường A/ })); await screen.findByRole('heading', { name: 'Hôm nay của các con' });
  });

  it('re-authorizes child/day on popstate and clears existing detail when the resolver is denied', async () => {
    document.cookie = 'parent_csrf=csrf'; const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; let deny = false;
    const fetch = vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); if (path.endsWith('/inbox/event-a/open')) return Promise.resolve(deny ? new Response(null, { status: 404 }) : new Response(JSON.stringify({ data: { studentId: 'student-a', date: '2026-09-27' } }))); return parentResponse(session, input); }); vi.stubGlobal('fetch', fetch);
    render(<ParentShell />); await screen.findByText('Bé An'); fireEvent.click(screen.getByRole('button', { name: /Bé AnTrường/ })); await screen.findByRole('heading', { name: 'Bé An' }); window.history.pushState(null, '', '/children/student-a/days/2026-09-27'); fireEvent.popState(window); await screen.findByRole('heading', { name: 'Bé An' }); expect(fetch.mock.calls.filter(([input]) => String(input).endsWith('/inbox/event-a/open'))).toHaveLength(1); deny = true; window.history.pushState(null, '', '/children/student-a/days/2026-09-27'); fireEvent.popState(window); const fallback = await screen.findByRole('heading', { name: 'Chọn trường để xem' }); expect(document.activeElement).toBe(fallback); expect(screen.queryByRole('heading', { name: 'Bé An' })).toBeNull();
  });

  it('defers popstate resolver until the inbox list arrives instead of falling back from an empty inbox', async () => {
    document.cookie = 'parent_csrf=csrf'; const inbox = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; const fetch = vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return inbox.promise; if (path.endsWith('/inbox/event-a/open')) return Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', date: '2026-09-27' } }))); return parentResponse(session, input); }); vi.stubGlobal('fetch', fetch);
    render(<ParentShell />); window.history.pushState(null, '', '/children/student-a/days/2026-09-27'); fireEvent.popState(window); expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull(); inbox.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); await screen.findByRole('heading', { name: 'Bé An' }); expect(fetch.mock.calls.some(([input]) => String(input).endsWith('/inbox/event-a/open'))).toBe(true);
  });

  it('keeps explicit Today or Inbox navigation when a delayed direct selector inbox result arrives', async () => {
    for (const chosen of ['Thông báo', 'Hôm nay']) { window.history.replaceState(null, '', '/children/student-a/days/2026-09-27'); document.cookie = 'parent_csrf=csrf'; const inbox = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; const fetch = vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return inbox.promise; if (path.endsWith('/inbox/event-a/open')) return Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', date: '2026-09-27' } }))); return parentResponse(session, input); }); vi.stubGlobal('fetch', fetch); render(<ParentShell />); await screen.findByText('Đang tải cập nhật...'); fireEvent.click(screen.getByRole('button', { name: new RegExp(chosen) })); inbox.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); if (chosen === 'Thông báo') await screen.findByRole('heading', { name: 'Thông báo' }); else await screen.findByRole('heading', { name: 'Hôm nay của các con' }); expect(window.location.pathname).toBe(chosen === 'Thông báo' ? '/inbox' : '/'); expect(fetch.mock.calls.some(([input]) => String(input).endsWith('/inbox/event-a/open'))).toBe(false); cleanup(); vi.unstubAllGlobals(); document.cookie = 'parent_csrf=; Max-Age=0'; }
  });

  it('finishes direct resolver loading so returning Today renders the normal safe context', async () => {
    window.history.replaceState(null, '', '/children/student-a/days/2026-09-27'); document.cookie = 'parent_csrf=csrf'; const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); if (path.endsWith('/inbox/event-a/open')) return Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', date: '2026-09-27' } }))); return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByRole('heading', { name: 'Bé An' }); fireEvent.click(screen.getByRole('button', { name: 'Quay lại Hôm nay' })); await screen.findByRole('button', { name: /Bé AnTrường/ }); expect(screen.queryByText('Đang tải cập nhật...')).toBeNull();
  });

  it('suppresses stale inbox opens and loads journal media only when requested, revoking it on exit', async () => {
    document.cookie = 'parent_csrf=csrf'; const first = deferred<Response>(); const second = deferred<Response>(); const blob = new Blob(['image'], { type: 'image/png' }); const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:journal'); const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' }, }, { schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }, { id: 'event-b', studentId: 'student-b', studentDisplayName: 'Bé Bình', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); if (path.endsWith('/event-a/open')) return first.promise; if (path.endsWith('/event-b/open')) return second.promise; if (path.includes('/daily-journal?')) return Promise.resolve(new Response(JSON.stringify({ data: { studentId: 'student-b', studentDisplayName: 'Bé Bình', journalDate: '2026-09-27', text: 'Nhận xét', updatedAt: '2026-09-27T01:00:00.000Z', media: [{ id: 'media', contentType: 'image/png' }] } }))); if (path.includes('/daily-journal-media/media')) return Promise.resolve(new Response(blob)); return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByText('Bé An'); fireEvent.click(screen.getByRole('button', { name: /Thông báo/ })); await screen.findByRole('heading', { name: 'Thông báo' }); await screen.findByRole('button', { name: /Bé Bình, Đã ghi nhận/ }); fireEvent.click(screen.getByRole('button', { name: /Bé An, Đã ghi nhận/ })); fireEvent.click(screen.getByRole('button', { name: /Bé Bình, Đã ghi nhận/ })); first.resolve(new Response(JSON.stringify({ data: { studentId: 'student-a', date: '2026-09-27' } }))); second.resolve(new Response(JSON.stringify({ data: { studentId: 'student-b', date: '2026-09-27' } }))); await screen.findByRole('heading', { name: 'Bé Bình' }); expect(screen.queryByRole('heading', { name: 'Bé An' })).toBeNull(); expect(create).not.toHaveBeenCalled(); fireEvent.click(await screen.findByRole('button', { name: 'Xem ảnh nhận xét' })); await screen.findByAltText('Ảnh nhận xét trong ngày'); expect(create).toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Quay lại Hôm nay' })); expect(revoke).toHaveBeenCalledWith('blob:journal'); create.mockRestore(); revoke.mockRestore();
  });

  it('clears direct route loading when the resolver returns a recoverable error', async () => {
    window.history.replaceState(null, '', '/children/student-a/days/2026-09-27'); document.cookie = 'parent_csrf=csrf'; const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'event-a', studentId: 'student-a', studentDisplayName: 'Bé An', eventType: 'ATTENDANCE', text: 'Đã ghi nhận có mặt', date: '2026-09-27', time: '2026-09-27T01:00:00.000Z', unread: true }] }))); if (path.endsWith('/inbox/event-a/open')) return Promise.resolve(new Response(null, { status: 500 })); return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByRole('alert'); expect(screen.queryByText('Đang tải cập nhật...')).toBeNull();
  });

  it('shows journal detail loading then a no-journal terminal state', async () => {
    const journal = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => String(input).includes('/daily-journal?') ? journal.promise : parentResponse(session, input)));
    render(<ParentShell />); await screen.findByRole('button', { name: /Bé AnTrường/ }); fireEvent.click(screen.getByRole('button', { name: /Bé AnTrường/ })); await screen.findByText('Đang tải nhận xét trong ngày...'); journal.resolve(new Response(JSON.stringify({ data: null }))); await screen.findByText('Chưa có nhận xét trong ngày này.');
  });

  it('does not clear workspace loading when a child is selected while its inbox load remains pending', async () => {
    const inbox = deferred<Response>(); const attendance = deferred<Response>(); const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] }; vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.endsWith('/inbox')) return inbox.promise; if (path.includes('/students/student-a/attendance')) return attendance.promise; return parentResponse(session, input); }));
    render(<ParentShell />); await screen.findByRole('button', { name: /Bé AnTrường/ }); fireEvent.click(screen.getByRole('button', { name: /Bé AnTrường/ })); await screen.findByRole('heading', { name: 'Bé An' }); fireEvent.click(screen.getByRole('button', { name: 'Quay lại Hôm nay' })); expect(screen.getByText('Đang tải cập nhật...')).toBeTruthy(); inbox.resolve(new Response(JSON.stringify({ data: [] }))); attendance.resolve(new Response(JSON.stringify({ data: [] }))); await screen.findByRole('button', { name: /Bé AnTrường/ }); expect(screen.queryByText('Đang tải cập nhật...')).toBeNull();
  });

});
