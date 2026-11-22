import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.ready.then(async (reg) => {
      // pré-carrega módulos sob demanda (relatório, visão molecular) para uso offline
      await Promise.allSettled([import('./report/pdf'), import('./report/technical'), import('./modes/learning/Molecular')]);
      const urls = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ type: 'cache', urls: [...new Set([location.href.split('#')[0], ...urls])] });
    });
  });
}
