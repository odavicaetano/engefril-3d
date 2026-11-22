import { useStore, saveProject, shareLink } from '../state/store';
import { I } from './Icons';

export default function TopBar() {
  const s = useStore();
  const modes = [
    { id: 'comercial', label: 'Comercial', icon: <I.briefcase width={16} height={16} /> },
    { id: 'aprendizado', label: 'Aprendizado', icon: <I.book width={16} height={16} /> },
    { id: 'tecnico', label: 'Técnico', icon: <I.chart width={16} height={16} /> },
  ] as const;
  const share = async () => {
    const url = shareLink(s.project);
    try { await navigator.clipboard.writeText(url); s.showToast('Link do cenário copiado. Os dados ficam no próprio link, sem servidor.'); }
    catch { prompt('Copie o link do cenário:', url); }
  };
  return (
    <header className="topbar">
      <button className="brand" onClick={() => s.setMode('home')} aria-label="Voltar à tela inicial">
        <img src="./favicon.svg" alt="" />
        <span className="brand-txt">ENGEFRIL 3D<small>Protótipo demonstrativo</small></span>
      </button>
      <nav className="modes" aria-label="Modos">
        {modes.map((m) => <button key={m.id} className={s.mode === m.id ? 'on' : ''} onClick={() => s.setMode(m.id)} aria-pressed={s.mode === m.id}>{m.icon}<span>{m.label}</span></button>)}
      </nav>
      <div className="spacer" />
      <div className="tb-actions">
        <button className="ib" data-tip="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled={!s.past.length} onClick={s.undo}><I.undo /></button>
        <button className="ib hide-m" data-tip="Refazer (Ctrl+Y)" aria-label="Refazer" disabled={!s.future.length} onClick={s.redo}><I.redo /></button>
        <button className="ib hide-m" data-tip="Salvar no navegador" aria-label="Salvar projeto" onClick={() => { saveProject(s.project); s.showToast(`“${s.project.name}” salvo neste navegador.`); }}><I.save /></button>
        <button className="ib hide-m" data-tip="Projetos, importar e exportar" aria-label="Projetos" onClick={() => s.setModal('projetos')}><I.upload /></button>
        <button className="ib hide-m" data-tip="Copiar link do cenário" aria-label="Compartilhar" onClick={share}><I.link /></button>
        <button className="ib" data-tip="Exportar Projeto em PDF" aria-label="Exportar Projeto em PDF" onClick={() => s.setModal('exportar')}><I.report /></button>
        <button className="ib" data-tip="Segurança com amônia" aria-label="Segurança" onClick={() => s.setModal('seguranca')}><I.shield /></button>
        <button className="ib hide-m" data-tip="Glossário" aria-label="Glossário" onClick={() => s.setModal('glossario')}><I.book /></button>
        <button className="ib" data-tip="Ajuda e controles" aria-label="Ajuda" onClick={() => s.setModal('controles')}><I.help /></button>
        <button className="ib" data-tip="Sobre, fontes e limitações" aria-label="Informações" onClick={() => s.setModal('sobre')}><I.info /></button>
      </div>
    </header>
  );
}
