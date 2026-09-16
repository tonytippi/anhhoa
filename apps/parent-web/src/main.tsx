import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
export function ParentShell() { return <main><h1>PassionEdu</h1><p>Cổng phụ huynh đang được khởi tạo.</p></main>; }

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><ParentShell /></StrictMode>);
