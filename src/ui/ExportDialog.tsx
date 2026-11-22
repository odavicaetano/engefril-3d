import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { captureScene } from '../scene/sceneUtils';
import { I } from './Icons';
import { Check, Seg } from './common';

type Tipo = 'comercial' | 'tecnico';
type Ori = 'auto' | 'retrato' | 'paisagem';

/** Exportação do projeto em PDF A4, com escolha do tipo de relatório, da orientação e pré-visualização. */
export default function ExportDialog() {
  const s = useStore();
  const [tipo, setTipo] = useState<Tipo>('tecnico');
  const [ori, setOri] = useState<Ori>('auto');
  const [rev, setRev] = useState('R0');
  const [withB, setWithB] = useState(!!s.scenarioB);
  const [with3D, setWith3D] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; pages: number | null; name: string } | null>(null);
  const urlRef = useRef<string | null>(null);
  const mobile = typeof innerWidth !== 'undefined' && innerWidth <= 820;

  const generate = async () => {
    setBusy(true); setErr(null);
    // cede um quadro para a interface mostrar "Gerando…" antes do trabalho síncrono
    await new Promise((r) => setTimeout(r, 30));
    try {
      const B = withB ? s.scenarioB : null;
      let blob: Blob, pages: number | null = null, name: string;
      const image = with3D ? captureScene('A') : null;
      if (tipo === 'tecnico') {
        const { buildTechnicalReport, technicalFileName } = await import('../report/technical');
        const doc = buildTechnicalReport(s.project, { orientation: ori, revision: rev.trim() || 'R0', compare: B, image });
        blob = doc.output('blob'); pages = doc.getNumberOfPages(); name = technicalFileName(s.project);
      } else {
        const { buildReport } = await import('../report/pdf');
        blob = await buildReport(s.project, B, { save: false, orientation: ori === 'paisagem' ? 'paisagem' : 'retrato' });
        const { slug } = await import('../report/common');
        name = `${slug(s.project.name)}_relatorio_comercial.pdf`;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPreview({ url, pages, name });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  useEffect(() => { generate(); }, [tipo, ori, withB, with3D]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const download = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview.url; a.download = preview.name; a.click();
    s.showToast('PDF exportado.');
  };
  return (
    <div className="modal-bg" onClick={() => s.setModal(null)}>
      <div className="modal wide export" role="dialog" aria-modal aria-label="Exportar projeto em PDF" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Exportar Projeto em PDF</h2>
          <button className="ib" aria-label="Fechar" onClick={() => s.setModal(null)}><I.close /></button>
        </div>
        <div className="export-body">
          <div className="export-opts">
            <div className="field"><span>Tipo de documento</span>
              <Seg value={tipo} onChange={setTipo} options={[{ value: 'tecnico', label: 'Relatório Técnico Completo' }, { value: 'comercial', label: 'Relatório Comercial' }]} />
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>{tipo === 'tecnico'
              ? 'Capa técnica, sumário, memorial descritivo, memorial de cálculo com fórmulas, desenhos vetoriais cotados (planta, detalhe da sala de máquinas, cortes, vista e diagrama do circuito), especificação de equipamentos, quadro de dimensionamento, análise energética e conclusões.'
              : 'Resumo para o cliente: capacidade, principais cargas, soluções sugeridas, comparação de cenários e premissas.'}</p>
            <div className="field"><span>Orientação (todas as páginas em A4)</span>
              <Seg value={ori} onChange={setOri} options={[...(tipo === 'tecnico' ? [{ value: 'auto' as Ori, label: 'Automática' }] : []), { value: 'retrato', label: 'Retrato' }, { value: 'paisagem', label: 'Paisagem' }]} />
            </div>
            {tipo === 'tecnico' && ori === 'auto' && <p className="small muted" style={{ marginTop: 0 }}>Texto e tabelas em retrato; folhas de desenho em paisagem.</p>}
            {tipo === 'tecnico' && (
              <label className="field"><span>Revisão do documento</span>
                <input value={rev} maxLength={8} onChange={(e) => setRev(e.target.value)} onBlur={generate} />
              </label>
            )}
            {s.scenarioB && <Check label="Incluir comparação com o cenário B" checked={withB} onChange={setWithB} />}
            <Check label={tipo === 'tecnico' ? 'Perspectiva 3D ilustrativa na capa' : 'Imagem da vista 3D atual'} checked={with3D} onChange={setWith3D} />
            <div className="insight warn small">Pré-dimensionamento orientativo: o documento não é projeto executivo, não tem assinatura nem ART e não substitui a seleção de catálogo.</div>
            <div className="btns">
              <button className="btn primary" disabled={!preview || busy} onClick={download}><I.download /> Baixar PDF</button>
              <button className="btn" disabled={busy} onClick={generate}><I.restart /> Atualizar pré-visualização</button>
            </div>
            {preview?.pages && <p className="small muted">{preview.pages} páginas A4 · {preview.name}</p>}
            {err && <div className="insight err small">Falha ao gerar: {err}</div>}
          </div>
          <div className="export-preview">
            {busy && <div className="export-busy">Gerando pré-visualização…</div>}
            {preview && !mobile && <iframe key={preview.url} title="Pré-visualização do PDF" src={`${preview.url}#view=FitH`} />}
            {preview && mobile && <div className="export-busy">A pré-visualização embutida não é suportada em navegadores móveis. Use “Baixar PDF” para abrir o documento.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
