import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
export function TeacherShell() { return <main><h1>PassionEdu - Giáo viên</h1><p>Cổng vận hành lớp đang được khởi tạo.</p></main>; }
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><TeacherShell /></StrictMode>);
