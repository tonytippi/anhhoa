import { useEffect, useRef, useState } from 'react';
type School = { schoolId: string; schoolName: string };
type Context = { schoolId: string; schoolName: string; navigation: Array<{ id: string; label: string }> };
const apiUrl = typeof __API_URL__ === 'undefined' ? '' : __API_URL__;
const denied = (status: number) => status === 403 || status === 404;

export function SchoolContext({ clear }: { clear: () => void }) {
  const [schools, setSchools] = useState<School[]>(); const [context, setContext] = useState<Context>(); const [dirty, setDirty] = useState(false); const [switchTo, setSwitchTo] = useState<string>(); const heading = useRef<HTMLHeadingElement>(null); const mounted = useRef(true); const loadVersion = useRef(0);
  const clearContext = () => { if (mounted.current) { setContext(undefined); setDirty(false); setSwitchTo(undefined); } };
  const chooser = async () => { const response = await fetch(`${apiUrl}/api/teacher/schools`, { credentials: 'include' }); if (response.status === 401) return clear(); if (!response.ok) throw new Error(); if (mounted.current) setSchools((await response.json() as { data: School[] }).data); };
  const load = async (schoolId: string) => { const version = ++loadVersion.current; setContext(undefined); const response = await fetch(`${apiUrl}/api/teacher/schools/${schoolId}`, { credentials: 'include' }); if (!mounted.current || version !== loadVersion.current) return; if (response.status === 401) return clear(); if (denied(response.status)) { clearContext(); return chooser(); } if (!response.ok) throw new Error(); const next = (await response.json() as { data: Context }).data; if (mounted.current && version === loadVersion.current) setContext(next); };
  const switchSchool = (schoolId: string) => { if (schoolId === context?.schoolId) return; if (dirty) setSwitchTo(schoolId); else void load(schoolId); };
  useEffect(() => { mounted.current = true; void chooser().then(() => undefined).catch(clear); return () => { mounted.current = false; }; }, []);
  useEffect(() => { heading.current?.focus(); }, [context?.schoolId]);
  if (!schools) return <p>Đang tải ngữ cảnh trường...</p>;
  if (!schools.length) return <p>Không có trường nào đang cấp quyền cho tài khoản này.</p>;
  return <section><label>Chọn trường <select aria-label="Chọn trường" value={context?.schoolId ?? ''} onChange={(event) => switchSchool(event.target.value)}><option value="" disabled>Chọn trường</option>{schools.map((school) => <option key={school.schoolId} value={school.schoolId}>{school.schoolName}</option>)}</select></label>{context && <><h1 ref={heading} tabIndex={-1}>PassionEdu - Giáo viên - {context.schoolName}</h1><nav aria-label="Điều hướng trường">{context.navigation.filter((item) => item.id !== 'access').map((item) => <span key={item.id}>{item.label} </span>)}</nav><button onClick={() => setDirty(true)}>Đánh dấu thay đổi chưa gửi</button></>}{switchTo && <><div className="dialog-backdrop" /><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="teacher-switch-title"><h2 id="teacher-switch-title">Đổi trường?</h2><p>Thay đổi chưa gửi sẽ không được tự lưu.</p><div className="dialog-actions"><button onClick={() => setSwitchTo(undefined)}>Ở lại</button><button className="danger-action" onClick={() => { const next = switchTo; setDirty(false); setSwitchTo(undefined); void load(next); }}>Bỏ nội dung và đổi trường</button></div></div></>}</section>;
}
