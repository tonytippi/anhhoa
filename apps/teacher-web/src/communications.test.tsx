import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JournalsWorkspace } from './journals/journals-workspace';
import { MessagesWorkspace } from './messages/messages-workspace';
import type { WorkspaceProps } from './school-context';

const props = (): WorkspaceProps => ({ schoolId: 'school', classes: [{ classId: 'class-1', className: 'Mầm', schoolYearName: '2026-2027' }], classId: 'class-1', chooseClass: vi.fn(), features: { dailyJournal: true, handover: true }, setGuard: vi.fn(), navigate: vi.fn(), base: '/schools/a' });
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const postsTo = (fetch: ReturnType<typeof vi.fn>, fragment: string) => fetch.mock.calls.filter(([url, init]) => String(url).includes(fragment) && (init as RequestInit | undefined)?.method === 'POST');

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

describe('Class note', () => {
  it('opens the whole-Class note first and saves it for every Parent of the Class', async () => {
    let saved: unknown = null;
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('daily-journal-roster')) return json({ data: { students: [{ studentId: 's1', fullName: 'Bé An', studentCode: 'AH-1', status: 'MISSING', version: null, updatedAt: null, text: null, media: [] }] } });
      if (url.includes('/class-notes?')) return json({ data: saved });
      if (url.endsWith('/class-notes') && init?.method === 'POST') { saved = { id: 'n', text: JSON.parse(String(init.body)).text, version: 1, updatedAt: '2026-09-05T08:00:00.000Z', media: [] }; return json({ data: { id: 'op', status: 'COMPLETED', outcome: saved } }); }
      return json({ data: null });
    });
    vi.stubGlobal('fetch', fetch);
    render(<JournalsWorkspace {...props()} />);
    expect(await screen.findByRole('heading', { name: 'Nhận xét chung · Mầm' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Nội dung nhận xét'), { target: { value: 'Cả lớp đi dã ngoại.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi nhận xét chung' }));
    await screen.findByText('Hệ thống đã xác nhận nhận xét hiện hành.');
    const [, init] = postsTo(fetch, '/class-notes')[0]!;
    expect(JSON.parse(String(init!.body))).toMatchObject({ classId: 'class-1', text: 'Cả lớp đi dã ngoại.', mediaIds: [] });
    expect(screen.getByText('Đã gửi')).toBeTruthy();
  });

  it('switches to a Student journal and asks before discarding a draft', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => json(url.includes('daily-journal-roster') ? { data: { students: [{ studentId: 's1', fullName: 'Bé An', studentCode: 'AH-1', status: 'CURRENT', version: 1, updatedAt: '2026-09-05T08:00:00.000Z', text: 'Bé ăn tốt.', media: [] }] } } : { data: null })));
    render(<JournalsWorkspace {...props()} />);
    fireEvent.change(await screen.findByLabelText('Nội dung nhận xét'), { target: { value: 'Nháp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xem/Sửa' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ và chuyển' }));
    expect(await screen.findByRole('heading', { name: 'Nhận xét cho Bé An' })).toBeTruthy();
    expect((screen.getByLabelText('Nội dung nhận xét') as HTMLTextAreaElement).value).toBe('Bé ăn tốt.');
  });
});

describe('Parent messages', () => {
  const thread = { studentId: 's1', fullName: 'Bé An', studentCode: 'AH-1', parents: [{ fullName: 'Mẹ An', relationshipLabel: 'Mẹ', hasAccount: true }], unreadCount: 1, lastMessage: { senderType: 'PARENT', body: 'Cô ơi', createdAt: '2026-09-05T01:00:00.000Z' } };
  it('lists unread threads, marks a conversation read and sends with idempotency headers', async () => {
    const messages = [{ id: 'm1', senderType: 'PARENT', senderName: 'Mẹ An', senderLabel: 'Mẹ', mine: false, body: 'Cô ơi', createdAt: '2026-09-05T01:00:00.000Z' }];
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('message-threads')) return json({ data: { students: [thread] } });
      if (url.endsWith('/messages/read?classId=class-1')) return json({ data: {} });
      if (url.includes('/students/s1/messages') && init?.method === 'POST') { messages.push({ id: 'm2', senderType: 'TEACHER', senderName: 'Cô Lan', senderLabel: 'Giáo viên lớp Mầm', mine: true, body: JSON.parse(String(init.body)).body, createdAt: '2026-09-05T02:00:00.000Z' }); return json({ data: { id: 'op', status: 'COMPLETED', outcome: {} } }); }
      if (url.includes('/students/s1/messages')) return json({ data: { studentId: 's1', parentReadAt: null, messages: [...messages] } });
      return json({ data: null });
    });
    vi.stubGlobal('fetch', fetch);
    render(<MessagesWorkspace {...props()} />);
    expect(await screen.findByLabelText('1 tin chưa đọc')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Bé An/ }));
    await screen.findByText('Mẹ · Mẹ An');
    await waitFor(() => expect(postsTo(fetch, '/messages/read')).toHaveLength(1));
    expect(screen.queryByLabelText('1 tin chưa đọc')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tin nhắn cho phụ huynh của Bé An'), { target: { value: 'Chào chị' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    expect(await screen.findByText('Chào chị')).toBeTruthy();
    const [, init] = postsTo(fetch, '/students/s1/messages').find(([url]) => !String(url).includes('/read'))!;
    const headers = init!.headers as Record<string, string>;
    expect(headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(init!.body))).toEqual({ classId: 'class-1', body: 'Chào chị' });
  });
});
