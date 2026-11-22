import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useStore } from './state/store';
import TopBar from './ui/TopBar';
import Toolbar from './ui/Toolbar';
import Legend from './ui/Legend';
import EquipmentPanel from './ui/EquipmentPanel';
import Modals from './ui/Modals';
import Home from './modes/Home';
import SidePanel from './ui/SidePanel';
import TourOverlay from './modes/learning/TourOverlay';
import HowItWorks from './ui/HowItWorks';
import { I } from './ui/Icons';
import PaneBadge from './ui/PaneBadge';

const Scene = lazy(() => import('./scene/Scene'));
const Molecular = lazy(() => import('./modes/learning/Molecular'));

class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err) return (
      <div className="loading"><div style={{ maxWidth: 520, padding: 24 }}>
        <h2>Não foi possível iniciar a visualização 3D</h2>
        <p>Verifique se o navegador suporta WebGL e se a aceleração gráfica está ativada. Os cálculos continuam disponíveis após recarregar.</p>
        <p className="small" style={{ opacity: .7 }}>{this.state.err.message}</p>
        <button className="btn primary" onClick={() => location.reload()}>Recarregar</button>
      </div></div>
    );
    return this.props.children;
  }
}

function webglOk() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export default function App() {
  const mode = useStore((s) => s.mode);
  const menuOpen = useStore((s) => s.menuOpen);
  const presentation = useStore((s) => s.presentation);
  const setPresentation = useStore((s) => s.setPresentation);
  const modal = useStore((s) => s.modal);
  const toast = useStore((s) => s.toast);
  const split = useStore((s) => s.view.split && !!s.scenarioB && s.mode !== 'home');
  const A = useStore((s) => s.project), B = useStore((s) => s.scenarioB);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
      if (e.key === 'Escape') { if (s.modal) s.setModal(null); else if (s.presentation) s.setPresentation(false); else s.setView({ selected: null, isolate: false }); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const ok = webglOk();
  const work = mode !== 'home' && !presentation;
  return (
    <div className={`app ${work && menuOpen ? 'with-side' : ''}`}>
      <ErrorBoundary>
        {ok ? <Suspense fallback={<div className="loading">Carregando instalação 3D…</div>}>
          {split && B ? (
            <div className={`split ${presentation ? 'presenting' : ''}`}>
              <div className="pane"><Scene project={A} side="A" />{!presentation && <PaneBadge side="A" p={A} other={B} />}</div>
              <div className="pane"><Scene project={B} side="B" />{!presentation && <PaneBadge side="B" p={B} other={A} />}</div>
            </div>
          ) : <Scene />}
        </Suspense>
          : <div className="loading"><p>WebGL indisponível neste navegador. A visualização 3D requer WebGL.</p></div>}
      </ErrorBoundary>
      {mode === 'home' && <Home />}
      {work && <TopBar />}
      {work && <SidePanel />}
      {work && <EquipmentPanel />}
      {mode !== 'home' && <Toolbar />}
      {work && <Legend />}
      {work && <TourOverlay />}
      {work && <HowItWorks />}
      {presentation && <button className="btn presenting-exit" onClick={() => setPresentation(false)}><I.close /> Sair da apresentação</button>}
      {modal === 'molecular' ? <Suspense fallback={null}><Molecular /></Suspense> : <Modals />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
