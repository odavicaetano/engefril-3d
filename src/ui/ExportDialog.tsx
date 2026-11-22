import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { captureScene } from '../scene/sceneUtils';
import { standardFileName } from '../design/tokens';
import { evalCached } from '../state/useEvaluation';
import { I } from './Icons';
import { Check, Seg, fmt } from './common';

type Formato = 'pdf' | 'planilha';
type Tipo = 'comercial' | 'tecnico';
type Ori = 'auto' | 'retrato' | 'paisagem';
const SECTIONS = [
  { id: 'descritivo', label: 'Memorial descritivo' }, { id: 'calculo', label: 'Memorial de cálculo' }, { id: 'desenhos', label: 'Desenhos técnicos' },
  { id: 'equipamentos', label: 'Especificação de equipamentos' }, { id: 'dimensionamento', label: 'Quadro de dimensionamento' }, { id: 'energia', label: 'Análise energética' }, { id: 'conclusoes', label: 'Conclusões técnicas' },
] as const;

/** ExportDialog: PDF (comercial/técnico) e planilha (XLSX/CSV), com pré-visualização e nome padronizado. */
export default function ExportDialog() {
  const s = useStore();
  const [formato, setFormato] = useState<Formato>('pdf');
  const [tipo, setTipo] = useState<Tipo>('tecnico');
  const [ori, setOri] = useState<Ori>('auto');
  const [rev, setRev] = useState('R0');
  const [client, setClient] = useState('');
  const [sections, setSections] = useState<Set<string>>(new Set(SECTIONS.map((x) => x.id)));
  const [withB, setWithB] = useState(!!s.scenarioB);
  const [with3D, setWith3D] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; pages: number | null; name: string; kind: Formato } | null>(null);
  const [sheetPreview, setSheetPreview] = useState<{ tabs: string[]; rows: [string, string, string][] } | null>(null);
  const urlRef = useRef<string | null>(null);
  const mobile = typeof innerWidth !== 'undefined' && innerWidth <= 820;

  const setUrl = (blob: Blob) => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); const u = URL.createObjectURL(blob); urlRef.current = u; return u; };
  const generate = async () => {
    setBusy(true); setErr(null);
    await new Promise((r) => setTimeout(r, 30)); // cede um quadro para mostrar o estado de carregamento
    try {
      const B = withB ? s.scenarioB : null;
      const revision = rev.trim() || 'R0';
      if (formato === 'pdf') {
        const image = with3D ? captureScene('A') : null;
        let doc;
        if (tipo === 'tecnico') {
          const { buildTechnicalReport } = await import('../report/technical');
          doc = buildTechnicalReport(s.project, { orientation: ori, revision, compare: B, image, client: client.trim() || undefined, sections: [...sections] as never });
        } else {
          const { buildCommercialReport } = await import('../report/pdf');
          doc = buildCommercialReport(s.project, B, { orientation: ori === 'paisagem' ? 'paisagem' : 'retrato', revision, client: client.trim() || undefined, image, imageA: B ? captureScene('A') : null, imageB: B ? captureScene('B') : null });
        }
        const name = standardFileName(s.project.name, tipo === 'tecnico' ? 'relatorio-tecnico' : 'relatorio-comercial', revision, 'pdf');
        setPreview({ url: setUrl(doc.output('blob')), pages: doc.getNumberOfPages(), name, kind: 'pdf' });
        setSheetPreview(null);
      } else {
        const [{ default: ExcelJS }, { buildWorkbook }] = await Promise.all([import('exceljs'), import('../report/spreadsheet')]);
        const { wb } = buildWorkbook(ExcelJS, s.project, { revision, client: client.trim() || undefined, compare: B });
        const buf = await wb.xlsx.writeBuffer();
        const name = standardFileName(s.project.name, 'planilha', revision, 'xlsx');
        setPreview({ url: setUrl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })), pages: null, name, kind: 'planilha' });
        const ws = wb.getWorksheet('Resumo')!;
        const rows: [string, string, string][] = [];
        ws.eachRow((r, i) => { if (i > 4) { const v = r.getCell(2).value as any; const val = v && typeof v === 'object' && 'result' in v ? v.result : v; const unitTxt = String(r.getCell(3).value ?? ''); rows.push([String(r.getCell(1).value ?? ''), typeof val === 'number' ? (unitTxt.startsWith('%') ? fmt(val * 100, 1) : fmt(val, Math.abs(val) < 10 ? 2 : 0)) : String(val ?? ''), unitTxt]); } });
        setSheetPreview({ tabs: wb.worksheets.map((w) => w.name), rows: rows.filter((r) => r[0]) });
      }
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  useEffect(() => { generate(); }, [formato, tipo, ori, withB, with3D, sections]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const download = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); s.showToast(`${name} exportado.`); };
  const downloadCsv = async () => {
    const { buildCsv } = await import('../report/spreadsheet');
    const url = URL.createObjectURL(new Blob([buildCsv(s.project)], { type: 'text/csv;charset=utf-8' }));
    download(url, standardFileName(s.project.name, 'resumo', rev.trim() || 'R0', 'csv'));
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const ev = evalCached(s.project);
  return (
    <div className="modal-bg" onClick={() => s.setModal(null)}>
      <div className="modal wide export" role="dialog" aria-modal aria-label="Exportar projeto" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Exportar projeto</h2>
          <button className="ib" aria-label="Fechar" onClick={() => s.setModal(null)}><I.close /></button>
        </div>
        <div className="export-body">
          <div className="export-opts">
            <div className="field"><span>Formato</span><Seg value={formato} onChange={setFormato} options={[{ value: 'pdf', label: 'PDF A4' }, { value: 'planilha', label: 'Planilha (XLSX/CSV)' }]} /></div>
            {formato === 'pdf' && <>
              <div className="field"><span>Tipo de documento</span>
                <Seg value={tipo} onChange={setTipo} options={[{ value: 'tecnico', label: 'Relatório Técnico Completo' }, { value: 'comercial', label: 'Relatório Comercial' }]} />
              </div>
              <div className="field"><span>Orientação (todas as páginas em A4)</span>
                <Seg value={ori} onChange={setOri} options={[...(tipo === 'tecnico' ? [{ value: 'auto' as Ori, label: 'Automática' }] : []), { value: 'retrato', label: 'Retrato' }, { value: 'paisagem', label: 'Paisagem' }]} />
              </div>
              {tipo === 'tecnico' && ori === 'auto' && <p className="small muted" style={{ marginTop: 0 }}>Texto e tabelas em retrato; folhas de desenho em paisagem.</p>}
              {tipo === 'tecnico' && (
                <details className="small" open={!mobile}><summary>Seções do relatório ({sections.size}/{SECTIONS.length})</summary>
                  {SECTIONS.map((x) => <Check key={x.id} label={x.label} checked={sections.has(x.id)} onChange={(v) => { const n = new Set(sections); v ? n.add(x.id) : n.delete(x.id); if (n.size) setSections(n); }} />)}
                  <p className="muted" style={{ margin: 0 }}>Capa e sumário são sempre incluídos; a numeração se ajusta às seções escolhidas.</p>
                </details>
              )}
            </>}
            {formato === 'planilha' && <p className="small muted" style={{ marginTop: 0 }}>XLSX com as abas Sobre, Resumo, Entradas, Cálculos (fórmulas auditáveis), Equipamentos, Cenários e Fontes e Premissas. CSV com o resumo em UTF-8, separador “;”.</p>}
            <div className="grid2">
              <label className="field"><span>Revisão</span><input value={rev} maxLength={8} onChange={(e) => setRev(e.target.value)} onBlur={generate} /></label>
              <label className="field"><span>Cliente (opcional)</span><input value={client} maxLength={60} onChange={(e) => setClient(e.target.value)} onBlur={generate} placeholder="Somente se informado" /></label>
            </div>
            {s.scenarioB && <Check label="Incluir comparação com o cenário B" checked={withB} onChange={setWithB} />}
            {formato === 'pdf' && <Check label={tipo === 'tecnico' ? 'Perspectiva 3D ilustrativa na capa' : 'Imagem da vista 3D atual'} checked={with3D} onChange={setWith3D} />}
            <div className="insight warn small">Estudo preliminar: os documentos não são projeto executivo e não têm assinatura, CREA, ART, homologação nem validação de engenheiro.</div>
            <div className="btns">
              <button className="btn" disabled={busy} onClick={generate}><I.eye /> Pré-visualizar</button>
              {formato === 'pdf'
                ? <button className="btn primary" disabled={!preview || busy || preview.kind !== 'pdf'} onClick={() => preview && download(preview.url, preview.name)}><I.download /> Exportar PDF</button>
                : <>
                  <button className="btn primary" disabled={!preview || busy || preview.kind !== 'planilha'} onClick={() => preview && download(preview.url, preview.name)}><I.download /> Exportar planilha (XLSX)</button>
                  <button className="btn" disabled={busy} onClick={downloadCsv}><I.download /> CSV</button>
                </>}
            </div>
            {busy && <p className="small muted"><span className="spin" aria-hidden /> Gerando…</p>}
            {preview && !busy && <p className="small muted">{preview.pages ? `${preview.pages} páginas A4 · ` : ''}{preview.name}</p>}
            {err && <div className="insight err small">Falha ao gerar: {err}. Tente novamente; se persistir, exporte o cenário em JSON e informe o erro.</div>}
          </div>
          <div className="export-preview">
            {busy && <div className="export-busy">Gerando pré-visualização…</div>}
            {preview?.kind === 'pdf' && !mobile && <iframe key={preview.url} title="Pré-visualização do PDF" src={`${preview.url}#view=FitH`} />}
            {preview?.kind === 'pdf' && mobile && <div className="export-busy">A pré-visualização embutida não é suportada em navegadores móveis. Use “Exportar PDF” para abrir o documento.</div>}
            {preview?.kind === 'planilha' && sheetPreview && (
              <div className="sheet-preview">
                <div className="sheet-tabs">{sheetPreview.tabs.map((t, i) => <span key={t} className={i === 1 ? 'on' : ''}>{t}</span>)}</div>
                <table className="t">
                  <thead><tr><th>Indicador (aba Resumo)</th><th>Valor</th><th>Unidade</th></tr></thead>
                  <tbody>{sheetPreview.rows.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td className="muted">{r[2]}</td></tr>)}</tbody>
                </table>
                <p className="small muted">Mesmos números do PDF (mesmo motor). Capacidade nominal: {fmt(ev.loads.nominal.requiredKW, 1)} kW.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
