import { useState } from 'react';
import { useStore } from '../../state/store';
import { I } from '../../ui/Icons';

export default function Report() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const gen = async () => {
    setBusy(true);
    try {
      const { buildReport } = await import('../../report/pdf');
      await buildReport(s.project, s.scenarioB);
      s.showToast('Relatório PDF gerado.');
    } catch (e) { s.showToast('Falha ao gerar o PDF: ' + (e as Error).message); }
    setBusy(false);
  };
  return (
    <div>
      <div className="card">
        <h3>Relatório comercial em PDF</h3>
        <p className="small">Inclui identificação do cenário, dados da instalação, imagem do modelo 3D (vista atual), portas, isolamento, produtos, cargas térmicas, soluções sugeridas, comparação de cenários (se houver), benefícios potenciais, premissas e limitações, fontes técnicas e dados necessários para a engenharia detalhada.</p>
        <p className="small muted">Dica: ajuste a câmera antes de gerar; a imagem 3D usa a vista atual.</p>
        <button className="btn primary" disabled={busy} onClick={gen}><I.report /> {busy ? 'Gerando…' : 'Gerar relatório PDF'}</button>
      </div>
      <div className="card"><p className="small muted" style={{ margin: 0 }}>O relatório é uma estimativa preliminar para apoio à decisão. Não é uma proposta contratual nem um projeto de engenharia.</p></div>
    </div>
  );
}
