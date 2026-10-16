import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiGet, apiMutate, apiPost, clock, hcmToday } from '../api';
import { ErrorNotice } from '../components';
import { ClassPicker, type WorkspaceProps } from '../school-context';
import { checkingMessage, unknownMessage, useOperation } from '../use-operation';

type Parent = { fullName: string; relationshipLabel: string; hasAccount: boolean };
type Thread = { studentId: string; fullName: string; studentCode: string; parents: Parent[]; unreadCount: number; lastMessage: { senderType: 'TEACHER' | 'PARENT'; body: string; createdAt: string } | null };
type Message = { id: string; senderType: 'TEACHER' | 'PARENT'; senderName: string; senderLabel: string; mine: boolean; body: string; createdAt: string };
type Conversation = { studentId: string; parentReadAt: string | null; messages: Message[] };
const pollMs = 30000;
const maxLength = 2000;
const when = (instant: string) => {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(instant));
  return day === hcmToday() ? clock(instant) : `${day.slice(8, 10)}/${day.slice(5, 7)} ${clock(instant)}`;
};
const studentFromUrl = () => new URLSearchParams(window.location.search).get('student') ?? undefined;

export function MessagesWorkspace({ schoolId, classes, classId, chooseClass, setGuard, navigate, base }: WorkspaceProps) {
  const [threads, setThreads] = useState<Thread[]>();
  const [loadError, setLoadError] = useState('');
  const [studentId, setStudentId] = useState<string | undefined>(studentFromUrl);
  const [conversation, setConversation] = useState<Conversation>();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const operation = useOperation(schoolId);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const conversationVersion = useRef(0);
  const classroom = classes.find((item) => item.classId === classId);

  useEffect(() => { setGuard({ dirty: Boolean(draft.trim()) || operation.unresolved, message: operation.unresolved ? 'Tin nhắn chưa được hệ thống xác nhận. Hãy kiểm tra lại kết quả trước khi rời.' : 'Tin nhắn đang soạn chưa được gửi.' }); }, [draft, operation.unresolved]);
  useEffect(() => () => setGuard({ dirty: false }), []);

  const loadThreads = async () => {
    const result = await apiGet<{ students: Thread[] }>(`/api/teacher/schools/${schoolId}/message-threads?classId=${classId}`, 'Không thể tải danh sách tin nhắn.');
    if (!result.ok) { setLoadError(result.error.message); return; }
    setLoadError('');
    setThreads(result.data.students);
  };
  const loadConversation = async (id: string, markRead = true) => {
    const current = ++conversationVersion.current;
    const result = await apiGet<Conversation>(`/api/teacher/schools/${schoolId}/students/${id}/messages?classId=${classId}`, 'Không thể tải tin nhắn.');
    if (current !== conversationVersion.current) return;
    if (!result.ok) { setError(result.error.message); return; }
    setConversation(result.data);
    if (markRead && result.data.messages.some((message) => message.senderType === 'PARENT')) {
      await apiPost(`/api/teacher/schools/${schoolId}/students/${id}/messages/read?classId=${classId}`);
      setThreads((list) => list?.map((thread) => (thread.studentId === id ? { ...thread, unreadCount: 0 } : thread)));
    }
  };
  useEffect(() => { void loadThreads(); }, [schoolId, classId]);
  useEffect(() => {
    setConversation(undefined); setError('');
    if (studentId) void loadConversation(studentId);
  }, [studentId, classId]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void loadThreads();
      if (studentId) void loadConversation(studentId);
    };
    const timer = window.setInterval(tick, pollMs);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [studentId, classId]);
  useEffect(() => {
    const restore = () => setStudentId(studentFromUrl());
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  useLayoutEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [conversation?.messages.length, studentId]);

  const open = (id?: string) => {
    if (draft.trim() && id !== studentId) { setGuard({ dirty: false }); setDraft(''); }
    operation.discard();
    navigate(id ? `${base}/messages?student=${id}` : `${base}/messages`);
    setStudentId(id);
  };
  const send = async () => {
    if (!studentId || !draft.trim() || operation.busy) return;
    setError('');
    const outcome = await operation.run((pending) => apiMutate(`/api/teacher/schools/${schoolId}/students/${studentId}/messages`, pending, { classId, body: draft.trim() }, 'Không thể gửi tin nhắn.'));
    await settle(outcome);
  };
  const settle = async (outcome: Awaited<ReturnType<typeof operation.run>>) => {
    if (outcome.ok === 'unknown') { setError(unknownMessage); return; }
    if (!outcome.ok) { setError(outcome.error.fieldErrors?.body ?? outcome.error.message); return; }
    setDraft('');
    if (studentId) await loadConversation(studentId, false);
    await loadThreads();
    composer.current?.focus();
  };
  const retry = async () => { setError(checkingMessage); await settle(await operation.retry()); };

  const selected = threads?.find((thread) => thread.studentId === studentId);
  const visibleThreads = (threads ?? [])
    .filter((thread) => `${thread.fullName} ${thread.studentCode} ${thread.parents.map((parent) => parent.fullName).join(' ')}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))
    .sort((a, b) => (b.unreadCount > 0 ? 1 : 0) - (a.unreadCount > 0 ? 1 : 0) || (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? '') || a.fullName.localeCompare(b.fullName, 'vi'));
  const unreadTotal = threads?.reduce((sum, thread) => sum + thread.unreadCount, 0) ?? 0;
  const reachable = selected?.parents.some((parent) => parent.hasAccount);
  const lastMine = conversation?.messages.filter((message) => message.senderType === 'TEACHER').at(-1);
  const seen = Boolean(lastMine && conversation?.parentReadAt && conversation.parentReadAt >= lastMine.createdAt);

  return (
    <section className="teacher-route active messages-route" data-view={studentId ? 'conversation' : 'list'} aria-labelledby="messages-title">
      <div className="route-head">
        <div>
          <p className="eyebrow">TIN NHẮN PHỤ HUYNH{unreadTotal ? ` · ${unreadTotal} CHƯA ĐỌC` : ''}</p>
          <h1 id="messages-title">Tin nhắn phụ huynh</h1>
          <p className="muted">Trao đổi riêng với phụ huynh của từng học sinh lớp {classroom?.className}. Mọi giáo viên của lớp cùng xem một cuộc trò chuyện.</p>
        </div>
        <div className="route-tools"><ClassPicker classes={classes} classId={classId} chooseClass={chooseClass} /></div>
      </div>
      {loadError ? <div className="empty"><h2>Không thể tải tin nhắn</h2><p className="muted">{loadError}</p><button className="button secondary" type="button" onClick={() => void loadThreads()}>Thử lại</button></div>
        : !threads ? <p className="teacher-loading" role="status">Đang tải danh sách tin nhắn...</p>
          : (
            <div className="messages-layout">
              <div className="thread-panel">
                <label className="thread-search"><span className="sr-only">Tìm học sinh hoặc phụ huynh</span><input type="search" placeholder="Tìm học sinh hoặc phụ huynh" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                <ul className="thread-list" aria-label="Học sinh trong lớp">
                  {visibleThreads.map((thread) => (
                    <li key={thread.studentId}>
                      <button type="button" className={`thread${thread.studentId === studentId ? ' active' : ''}`} aria-current={thread.studentId === studentId ? 'true' : undefined} onClick={() => open(thread.studentId)}>
                        <span className="thread-top">
                          <span className="student-name">{thread.fullName}</span>
                          {thread.lastMessage && <span className="thread-time">{when(thread.lastMessage.createdAt)}</span>}
                        </span>
                        <span className="thread-bottom">
                          <span className="thread-preview">{thread.lastMessage ? `${thread.lastMessage.senderType === 'TEACHER' ? 'Lớp: ' : ''}${thread.lastMessage.body}` : thread.parents.length ? thread.parents.map((parent) => `${parent.relationshipLabel} ${parent.fullName}`).join(', ') : 'Chưa liên kết phụ huynh'}</span>
                          {thread.unreadCount > 0 && <span className="unread-badge" aria-label={`${thread.unreadCount} tin chưa đọc`}>{thread.unreadCount}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!visibleThreads.length && <li className="journal-empty">Không có học sinh phù hợp.</li>}
                </ul>
              </div>
              <div className="chat-panel editor-panel">
                {!selected ? (
                  <div className="chat-empty"><p className="eyebrow">CHỌN HỌC SINH</p><h2>Chọn một học sinh để xem tin nhắn</h2><p className="muted">Tin nhắn được gửi tới tất cả phụ huynh đã liên kết với học sinh. Phụ huynh thấy bạn là “Giáo viên lớp {classroom?.className}”.</p></div>
                ) : (
                  <>
                    <header className="chat-head">
                      <button type="button" className="button secondary chat-back" onClick={() => open(undefined)}>‹ Danh sách</button>
                      <div>
                        <h2>{selected.fullName}</h2>
                        <p className="muted">{selected.parents.length ? selected.parents.map((parent) => `${parent.relationshipLabel}: ${parent.fullName}${parent.hasAccount ? '' : ' (chưa đăng nhập ứng dụng)'}`).join(' · ') : 'Chưa liên kết phụ huynh'}</p>
                      </div>
                    </header>
                    <div className="chat-scroll" ref={scroller} aria-live="polite">
                      {!conversation ? <p className="teacher-loading" role="status">Đang tải tin nhắn...</p>
                        : !conversation.messages.length ? <p className="chat-start muted">Chưa có tin nhắn. Gửi lời chào đầu tiên tới phụ huynh của {selected.fullName}.</p>
                          : conversation.messages.map((message) => (
                            <article key={message.id} className={`bubble ${message.mine ? 'mine' : message.senderType === 'TEACHER' ? 'colleague' : 'theirs'}`}>
                              {!message.mine && <p className="bubble-author">{message.senderType === 'PARENT' ? `${message.senderLabel} · ${message.senderName}` : message.senderName}</p>}
                              <p className="bubble-body">{message.body}</p>
                              <time dateTime={message.createdAt}>{when(message.createdAt)}{message.mine && message === lastMine && seen ? ' · Phụ huynh đã xem' : ''}</time>
                            </article>
                          ))}
                    </div>
                    <ErrorNotice message={error} onRetry={operation.unresolved ? () => void retry() : undefined} />
                    {!reachable && <p className="chat-hint">Phụ huynh chưa đăng nhập ứng dụng nên sẽ thấy tin nhắn khi đăng nhập lần đầu.</p>}
                    <form className="composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
                      <label className="sr-only" htmlFor="message-draft">Tin nhắn cho phụ huynh của {selected.fullName}</label>
                      <textarea id="message-draft" ref={composer} rows={2} maxLength={maxLength} placeholder="Nhập tin nhắn..." value={draft} disabled={operation.unresolved} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia?.('(pointer: fine)').matches) { event.preventDefault(); void send(); }
                      }} />
                      <button className="button" type="submit" disabled={!draft.trim() || operation.busy || operation.unresolved}>{operation.busy ? 'Đang gửi...' : 'Gửi'}</button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
    </section>
  );
}
