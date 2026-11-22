import { useEffect } from 'react';
import { useStore } from '../state/store';
import { I } from '../ui/Icons';

export default function Home() {
  const s = useStore();
  useEffect(() => {
    // câmera orbitando lentamente ao fundo
    s.goCamera('geral');
    s.setView({ selected: null, isolate: false, cut: 'nenhum', explode: 0 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (m: 'comercial' | 'aprendizado' | 'tecnico') => { s.setMode(m); s.setMenuOpen(innerWidth > 820); };
  return (
    <main className="home">
      <h1><img src="./favicon.svg" alt="" />ENGEFRIL 3D</h1>
      <div className="tag">Refrigeração Industrial Interativa</div>
      <p className="sub">Explore a engenharia do frio, compreenda seus processos e visualize soluções para sua indústria.</p>
      <div className="mode-cards">
        <button className="mode-card" onClick={() => go('comercial')}><I.briefcase /><b>MODO COMERCIAL</b><span>Configure seu projeto e explore soluções de refrigeração.</span></button>
        <button className="mode-card" onClick={() => go('aprendizado')}><I.book /><b>MODO APRENDIZADO</b><span>Descubra como a refrigeração industrial funciona.</span></button>
        <button className="mode-card" onClick={() => go('tecnico')}><I.chart /><b>MODO TÉCNICO</b><span>Explore equipamentos, parâmetros e processos termodinâmicos.</span></button>
      </div>
      <div className="home-links">
        <button onClick={() => s.setModal('sobre')}>Sobre a plataforma</button>
        <button onClick={() => s.setModal('controles')}>Controles</button>
        <button onClick={() => s.setModal('fontes')}>Fontes</button>
        <button onClick={() => s.setModal('sobre')}>Limitações técnicas</button>
        <button onClick={() => s.setModal('seguranca')}>Segurança com NH₃</button>
      </div>
      <p className="disclaimer">Protótipo demonstrativo inspirado na Engefril, sem vínculo, parceria ou aprovação oficial da empresa. Os resultados são estimativas preliminares e não substituem projeto de engenharia.</p>
    </main>
  );
}
