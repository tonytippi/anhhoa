import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
export function OpsShell() { return <main><h1>PassionEdu - Vận hành nền tảng</h1><p>Quản lý trường đang được khởi tạo.</p></main>; }
const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><OpsShell /></StrictMode>);
