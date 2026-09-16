import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
export function AdminShell() { return <main><h1>PassionEdu - Quản trị trường</h1><p>Cổng quản trị đang được khởi tạo.</p></main>; }

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><AdminShell /></StrictMode>);
