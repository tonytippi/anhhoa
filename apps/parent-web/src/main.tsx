import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import './styles.css';
import './account-header.css';
import './invoice-detail.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
