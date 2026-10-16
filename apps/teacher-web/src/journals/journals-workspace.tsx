import { useEffect, useRef, useState } from 'react';
import { acceptedImages, apiGet, apiMutate, clock, fullDay, hcmToday } from '../api';
import { Dialog, ErrorNotice, ProtectedImage } from '../components';
import { ClassPicker, type WorkspaceProps } from '../school-context';
import { checkingMessage, unknownMessage, useOperation } from '../use-operation';

type Media = { id: string; contentType: string };
type Student = { studentId: string; fullName: string; studentCode: string; status: 'CURRENT' | 'MISSING'; version: number | null; updatedAt: string | null; text: string | null; media: Media[] };
type ClassNote = { id: string; text: string; version: number; updatedAt: string; media: Media[] } | null;
type Target = { kind: 'class' } | { kind: 'student'; studentId: string };
type Draft = { text: string; media: Media[] };
const maxImageBytes = 10 * 1024 * 1024;

export function JournalsWorkspace({ schoolId, classes, classId, chooseClass, setGuard, navigate, base }: WorkspaceProps) {
  const day = hcmToday();
  const [students, setStudents] = useState<Student[]>();
  const [note, setNote] = useState<ClassNote>();
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'MISSING' | 'CURRENT'>('ALL');
  const [target, setTarget] = useState<Target>({ kind: 'class' });
  const [draft, setDraft] = useState<Draft>({ text: '', media: [] });
  const [saved, setSaved] = useState<Draft>({ text: '', media: [] });
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [uploading, setUploading] = useState(false);
  const [switchTo, setSwitchTo] = useState<Target>();
  const operation = useOperation(schoolId);
  const editor = useRef<HTMLElement>(null);
  const classroom = classes.find((item) => item.classId === classId);

  const dirty = draft.text !== saved.text || draft.media.map((item) => item.id).join() !== saved.media.map((item) => item.id).join();
  useEffect(() => { setGuard({ dirty: dirty || operation.unresolved, message: operation.unresolved ? 'Nhận xét chưa được hệ thống xác nhận. Hãy kiểm tra lại kết quả trước khi rời.' : 'Nhận xét đang soạn chưa được lưu.' }); }, [dirty, operation.unresolved]);
  useEffect(() => () => setGuard({ dirty: false }), []);

  const draftFor = (next: Target, list = students, classNote = note): Draft => {
    if (next.kind === 'class') return { text: classNote?.text ?? '', media: classNote?.media ?? [] };
    const student = list?.find((item) => item.studentId === next.studentId);
    return { text: student?.text ?? '', media: student?.media ?? [] };
  };
  const load = async (keep?: Target) => {
    setLoadError('');
    const [roster, classNote] = await Promise.all([
      apiGet<{ students: Student[] }>(`/api/teacher/schools/${schoolId}/daily-journal-roster?classId=${classId}&journalDate=${day}`, 'Không thể tải nhận xét trong ngày.'),
      apiGet<ClassNote>(`/api/teacher/schools/${schoolId}/class-notes?classId=${classId}&noteDate=${day}`, 'Không thể tải nhận xét chung.'),
    ]);
    if (!roster.ok) { setLoadError(roster.error.message); return; }
    const nextNote = classNote.ok ? classNote.data : null;
    setStudents(roster.data.students);
    setNote(nextNote);
    const nextTarget = keep ?? target;
    const nextDraft = draftFor(nextTarget, roster.data.students, nextNote);
    setTarget(nextTarget);
    setDraft(nextDraft);
    setSaved(nextDraft);
  };
  useEffect(() => { void load({ kind: 'class' }); }, [schoolId, classId]);

  const select = (next: Target, force = false) => {
    if (!force && (dirty || operation.unresolved)) { setSwitchTo(next); return; }
    operation.discard();
    const nextDraft = draftFor(next);
    setTarget(next); setDraft(nextDraft); setSaved(nextDraft); setError(''); setFeedback('');
    window.requestAnimationFrame(() => { if (window.matchMedia?.('(max-width: 1023px)').matches) editor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); editor.current?.querySelector('textarea')?.focus({ preventScroll: true }); });
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(''); setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!acceptedImages.includes(file.type) || file.size > maxImageBytes) { setError('Chỉ nhận ảnh JPEG, PNG hoặc WebP tối đa 10 MB mỗi ảnh.'); return; }
        const path = target.kind === 'class'
          ? `/api/teacher/schools/${schoolId}/class-note-media?classId=${classId}&noteDate=${day}`
          : `/api/teacher/schools/${schoolId}/daily-journal-media?classId=${classId}&studentId=${target.studentId}&journalDate=${day}`;
        const outcome = await operation.run<Media>((pending) => apiMutate(path, pending, file, 'Không thể tải ảnh.', file.type));
        if (outcome.ok === 'unknown') { setError(unknownMessage); return; }
        if (!outcome.ok) { setError(outcome.error.fieldErrors?.media ?? outcome.error.message); return; }
        const media = { id: outcome.operation.outcome.id, contentType: outcome.operation.outcome.contentType };
        setDraft((current) => ({ ...current, media: [...current.media, media] }));
      }
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    setError(''); setFeedback('Đã gửi nhận xét. Hệ thống đang xác nhận phiên bản hiện hành.');
    const body = target.kind === 'class'
      ? { classId, noteDate: day, text: draft.text, mediaIds: draft.media.map((item) => item.id) }
      : { classId, studentId: target.studentId, journalDate: day, text: draft.text, mediaIds: draft.media.map((item) => item.id) };
    const path = target.kind === 'class' ? `/api/teacher/schools/${schoolId}/class-notes` : `/api/teacher/schools/${schoolId}/daily-journals`;
    const outcome = await operation.run((pending) => apiMutate(path, pending, body, 'Không thể lưu nhận xét.'));
    await settle(outcome);
  };
  const settle = async (outcome: Awaited<ReturnType<typeof operation.run>>) => {
    if (outcome.ok === 'unknown') { setFeedback(''); setError(unknownMessage); return; }
    if (!outcome.ok) { setFeedback(''); setError(outcome.error.fieldErrors ? Object.values(outcome.error.fieldErrors)[0] ?? outcome.error.message : outcome.error.message); return; }
    await load(target);
    setFeedback('Hệ thống đã xác nhận nhận xét hiện hành.');
  };
  const retry = async () => { setError(checkingMessage); await settle(await operation.retry()); };

  if (loadError) return (
    <section className="teacher-route active" aria-labelledby="journals-title">
      <JournalsHead day={day} base={base} navigate={navigate} classes={classes} classId={classId} chooseClass={chooseClass} />
      <div className="empty"><h2>Không thể mở nhận xét trong ngày</h2><p className="muted">{loadError}</p><button className="button secondary" type="button" onClick={() => void load()}>Thử lại</button></div>
    </section>
  );
  const rows = students?.filter((student) => (filter === 'ALL' || student.status === filter) && `${student.fullName} ${student.studentCode}`.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) ?? [];
  const showClassRow = filter === 'ALL' && !query.trim();
  const current = target.kind === 'student' ? students?.find((item) => item.studentId === target.studentId) : undefined;
  const currentStamp = target.kind === 'class' ? note?.updatedAt : current?.updatedAt;
  const busy = operation.busy || uploading;
  const mediaPath = (id: string) => target.kind === 'class' ? `/api/teacher/schools/${schoolId}/class-note-media/${id}` : `/api/teacher/schools/${schoolId}/daily-journal-media/${id}`;

  return (
    <section className="teacher-route active" aria-labelledby="journals-title">
      <JournalsHead day={day} base={base} navigate={navigate} classes={classes} classId={classId} chooseClass={chooseClass} />
      <form className="journal-filter" onSubmit={(event) => event.preventDefault()}>
        <label>Tìm học sinh<input type="search" placeholder="Tên hoặc mã học sinh" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Trạng thái<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="ALL">Tất cả trạng thái</option><option value="MISSING">Chưa có nhận xét</option><option value="CURRENT">Đã có nhận xét</option></select></label>
      </form>
      {!students ? <p className="teacher-loading" role="status">Đang tải nhận xét trong ngày...</p> : (
        <div className="journal-layout">
          <div>
            <div className="table-wrap">
              <table className="teacher-table stack-on-phone">
                <caption>{rows.length} học sinh · {students.filter((student) => student.status === 'CURRENT').length} đã có nhận xét</caption>
                <thead><tr><th>Học sinh</th><th>Trạng thái</th><th>Cập nhật</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
                <tbody>
                  {showClassRow && (
                    <tr className={`class-note-row${target.kind === 'class' ? ' selected' : ''}`}>
                      <td><span className="student-name">Cả lớp {classroom?.className}</span><span className="student-code">Nhận xét chung · mọi phụ huynh trong lớp đều xem được</span></td>
                      <td data-label="Trạng thái"><span className={`badge ${note ? 'success' : 'neutral'}`}>{note ? 'Đã gửi' : 'Chưa gửi'}</span></td>
                      <td className="muted" data-label="Cập nhật">{note ? clock(note.updatedAt) : 'Chưa gửi'}</td>
                      <td><button className="button secondary" type="button" aria-pressed={target.kind === 'class'} onClick={() => select({ kind: 'class' })}>{note ? 'Xem/Sửa' : 'Viết nhận xét chung'}</button></td>
                    </tr>
                  )}
                  {rows.map((student) => {
                    const active = target.kind === 'student' && target.studentId === student.studentId;
                    return (
                      <tr key={student.studentId} className={active ? 'selected' : undefined}>
                        <td><span className="student-name">{student.fullName}</span><span className="student-code">{student.studentCode}</span></td>
                        <td data-label="Trạng thái"><span className={`badge ${student.status === 'CURRENT' ? 'success' : 'neutral'}`}>{student.status === 'CURRENT' ? 'Đã có nhận xét' : 'Chưa có nhận xét'}</span></td>
                        <td className="muted" data-label="Cập nhật">{student.updatedAt ? clock(student.updatedAt) : 'Chưa gửi'}</td>
                        <td><button className="button secondary" type="button" aria-pressed={active} onClick={() => select({ kind: 'student', studentId: student.studentId })}>{student.status === 'CURRENT' ? 'Xem/Sửa' : 'Viết nhận xét'}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!rows.length && <p className="journal-empty">Không có học sinh phù hợp với bộ lọc đang chọn.</p>}
          </div>
          <aside className="editor-panel" ref={editor} aria-labelledby="editor-title">
            <p className="eyebrow">{target.kind === 'class' ? 'NHẬN XÉT CHUNG CHO CẢ LỚP' : 'ĐANG CHỈNH SỬA'}</p>
            <h2 id="editor-title">{target.kind === 'class' ? `Nhận xét chung · ${classroom?.className ?? ''}` : `Nhận xét cho ${current?.fullName ?? ''}`}</h2>
            <p className="editor-copy">
              {target.kind === 'class'
                ? `Hoạt động chung trong ngày gửi tới phụ huynh của ${students.length} học sinh. ${currentStamp ? `Hệ thống đã xác nhận phiên bản hiện hành lúc ${clock(currentStamp)}.` : 'Phụ huynh chỉ xem sau khi hệ thống xác nhận.'}`
                : currentStamp ? `Hệ thống đã xác nhận phiên bản hiện hành lúc ${clock(currentStamp)}.` : 'Bạn vẫn có thể soạn nhận xét, nhưng phụ huynh chỉ xem sau khi hệ thống xác nhận.'}
            </p>
            <label>Nội dung nhận xét<textarea value={draft.text} maxLength={5000} placeholder={target.kind === 'class' ? 'Ví dụ: Hôm nay cả lớp học vẽ tranh mùa thu và chơi ngoài trời...' : ''} onChange={(event) => { setDraft({ ...draft, text: event.target.value }); setFeedback(''); }} /></label>
            {draft.media.length > 0 && (
              <ul className="photo-grid" aria-label="Ảnh đính kèm">
                {draft.media.map((item, index) => (
                  <li key={item.id}>
                    <ProtectedImage path={mediaPath(item.id)} alt={`Ảnh ${index + 1}`} />
                    <button type="button" className="photo-remove" aria-label={`Bỏ ảnh ${index + 1}`} onClick={() => setDraft({ ...draft, media: draft.media.filter((media) => media.id !== item.id) })}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <label>Ảnh trong ngày<input type="file" accept={acceptedImages.join(',')} multiple disabled={busy} onChange={(event) => { void upload(event.target.files); event.target.value = ''; }} /></label>
            <ErrorNotice message={error} onRetry={operation.unresolved ? () => void retry() : undefined} />
            <div className="editor-actions">
              <button className="button" type="button" disabled={busy || !draft.text.trim() || (!dirty && Boolean(currentStamp))} onClick={() => void save()}>{operation.busy && !uploading ? 'Đang lưu...' : target.kind === 'class' ? 'Gửi nhận xét chung' : 'Lưu nhận xét'}</button>
              <p className="editor-feedback" aria-live="polite">{uploading ? 'Đang tải ảnh...' : feedback}</p>
            </div>
          </aside>
        </div>
      )}
      {switchTo && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="journal-switch-title">
            <h2 id="journal-switch-title">Bỏ nhận xét đang soạn?</h2>
            <p>{operation.unresolved ? 'Nhận xét trước chưa được hệ thống xác nhận. Nếu chuyển, bạn cần mở lại để kiểm tra.' : 'Nội dung chưa lưu sẽ bị bỏ.'}</p>
            <div className="dialog-actions">
              <button className="button secondary" type="button" onClick={() => setSwitchTo(undefined)}>Tiếp tục soạn</button>
              <button className="button danger" type="button" onClick={() => { const next = switchTo; setSwitchTo(undefined); select(next, true); }}>Bỏ và chuyển</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function JournalsHead({ day, base, navigate, classes, classId, chooseClass }: Pick<WorkspaceProps, 'base' | 'navigate' | 'classes' | 'classId' | 'chooseClass'> & { day: string }) {
  return (
    <div className="route-head">
      <div>
        <p className="eyebrow">NHẬN XÉT TRONG NGÀY · {fullDay(day)}</p>
        <h1 id="journals-title">Nhận xét trong ngày</h1>
        <p className="muted">Một phiên tập trung để soạn, xem lại và lưu nhận xét cho phụ huynh — từng bé hoặc chung cho cả lớp.</p>
      </div>
      <div className="route-tools">
        <ClassPicker classes={classes} classId={classId} chooseClass={chooseClass} />
        <a className="button secondary" href={base} onClick={(event) => { event.preventDefault(); navigate(base); }}>Về lớp hôm nay</a>
      </div>
    </div>
  );
}
