import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import type { CadModel, Detection } from '../cad/model';
import { LIMITS, UNIT_CHOICES, unitGuess } from '../cad/model';
import { CATEGORIES, STATUS_LABEL, recognize, suggestCategory, type Category, type Status } from '../cad/recognize';
import { applyImport, referenceSegments } from '../cad/apply';
import { toRoomCoords } from '../cad/recognize';
import { sniff, readInWorker, type ReadJob } from '../cad/client';
import { CadIso, CadPlan, CAT_COLOR, FileTypeIcon } from './CadPreview';
import { I } from './Icons';
import { Check, Num, fmt } from './common';

const STEPS = ['Arquivo', 'Leitura', 'Unidades', 'Mapeamento', 'Prévia 3D', 'Confirmar'] as const;
const STEP_ICON = [I.importCad, I.plan, I.ruler, I.layers, I.cube, I.check];
const FORMATS = [
  { ext: 'DWG', title: 'DWG: desenho nativo do AutoCAD (versões 2000 a 2025). Lido localmente pelo GNU LibreDWG.' },
  { ext: 'BAK', title: 'BAK: cópia de segurança criada pelo AutoCAD. Aceito somente se o conteúdo for um DWG válido.' },
  { ext: 'DXF', title: 'DXF: formato de intercâmbio aberto (ASCII). Recomendado quando o DWG não abrir.' },
];
const StatusChip = ({ s }: { s: Status }) => <span className={`chip st-${s}`}>{STATUS_LABEL[s]}</span>;

/** Assistente de importação de desenhos CAD (DWG, BAK, DXF) com validação e prévias antes de alterar a cena. */
export default function ImportCadDialog() {
  const s = useStore();
  const [step, setStep] = useState(0);
  const [det, setDet] = useState<Detection | null>(null);
  const [model, setModel] = useState<CadModel | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnit] = useState('mm');
  const [rotation, setRotation] = useState(0);
  const [layers, setLayers] = useState<Set<string>>(new Set());
  const [mapping, setMapping] = useState<Record<string, Category>>({});
  const [roomIdx, setRoomIdx] = useState(0);
  const [height, setHeight] = useState(s.project.room.height);
  const [doorSel, setDoorSel] = useState<Set<string>>(new Set());
  const [replaceDoors, setReplaceDoors] = useState(true);
  const [applyPanel, setApplyPanel] = useState(true);
  const [confirmDims, setConfirmDims] = useState(false);
  const [view, setView] = useState<'planta' | 'iso'>('planta');
  const job = useRef<ReadJob | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => job.current?.cancel(), []);

  const toM = UNIT_CHOICES.find((u) => u.id === unit)?.toM ?? 1;
  const rec = useMemo(() => (model ? recognize(model, toM, mapping, layers) : null), [model, toM, mapping, layers]);
  const room = rec?.rooms[roomIdx] ?? null;
  const doors = (rec?.doors ?? []).filter((d) => doorSel.has(d.id));

  const pick = async (file: File) => {
    setError(null); setModel(null); job.current?.cancel();
    const { det: d, bytes } = await sniff(file);
    setDet(d); setStep(1);
    if (!d.ok) { setError(d.message); return; }
    setProgress('Iniciando leitor isolado (Web Worker)…');
    job.current = readInWorker(file.name, bytes, setProgress);
    try {
      const m = await job.current.promise;
      const g = unitGuess(m);
      const map: Record<string, Category> = {};
      m.layers.forEach((l) => (map[l.name] = suggestCategory(l.name, m.entities.filter((e) => e.layer === l.name)).cat));
      setModel(m); setUnit(g.unit); setMapping(map);
      setLayers(new Set(m.layers.filter((l) => l.count > 0 && !l.off && !l.frozen).map((l) => l.name)));
      setProgress('');
    } catch (e) { setError((e as Error).message); setProgress(''); }
  };
  // seleciona por padrão as portas reconhecidas quando a câmara muda
  useEffect(() => { if (rec) setDoorSel(new Set(rec.doors.filter((d) => d.status === 'reconhecido').map((d) => d.id))); }, [rec?.rooms.length, roomIdx, rec?.doors.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const guess = model ? unitGuess(model) : null;
  const refSegs = useMemo(() => (model && room ? referenceSegments(model, layers, mapping, toRoomCoords(room, toM)) : []), [model, room, layers, mapping, toM]);
  const preview = useMemo(() => (model ? applyImport(s.project, { model, unit, toM, rotationDeg: rotation, room, heightM: height, doors, replaceDoors, applyPanel, layers: [...layers], mapping, confirmDims }) : null), [model, unit, toM, rotation, room, height, doors, replaceDoors, applyPanel, layers, mapping, confirmDims, s.project]); // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = [!!model, !!model, !!model && layers.size > 0, !!model, !!preview, false][step];
  const finish = (mode: 'aplicar' | 'comparar') => {
    if (!preview) return;
    if (mode === 'aplicar') { s.setProject(preview); s.showToast('Desenho importado. Use Desfazer (Ctrl+Z) para voltar ao cenário anterior.'); }
    else { s.setScenarioB({ ...preview, name: `${preview.name} · importado do CAD` }); s.setEditing('A'); s.setView({ split: true }); s.setMode('comercial'); s.showToast('Importação aberta como cenário B, lado a lado com o projeto atual.'); }
    s.setModal(null);
  };

  return (
    <div className="modal-bg" onClick={() => s.setModal(null)}>
      <div className="modal wide cad-dialog" role="dialog" aria-modal aria-label="Importar desenho CAD" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Importar desenho CAD</h2><button className="ib" aria-label="Fechar" onClick={() => s.setModal(null)}><I.close /></button></div>
        <ol className="wizard" aria-label="Etapas da importação">
          {STEPS.map((t, i) => { const Ico = STEP_ICON[i]; return <li key={t} className={i === step ? 'on' : i < step ? 'done' : ''}><button disabled={i > step && !(model && i <= 4)} onClick={() => setStep(i)}><Ico width={16} height={16} /> {t}</button></li>; })}
        </ol>
        <div className="wizard-progress"><i style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>
        <div className="modal-body">
          {step === 0 && (
            <div>
              <div className="dropzone" tabIndex={0} role="button" aria-label="Selecionar arquivo DWG, BAK ou DXF"
                onClick={() => fileInput.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pick(f); }}>
                <div className="ftypes">{FORMATS.map((f) => <FileTypeIcon key={f.ext} ext={f.ext} title={f.title} />)}</div>
                <b>Arraste o arquivo aqui ou clique para selecionar</b>
                <span className="small muted">Aceitos: .dwg (AutoCAD 2000 a 2025), .bak (somente se contiver DWG válido) e .dxf ASCII. Limite de {LIMITS.maxBytes / 1048576} MB.</span>
              </div>
              <input ref={fileInput} type="file" hidden accept=".dwg,.bak,.dxf,.DWG,.BAK,.DXF" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
              <ul className="clean small" style={{ marginTop: 12 }}>
                <li><b>Privacidade:</b> o desenho é lido no seu navegador e não é enviado a nenhum servidor.</li>
                <li><b>Segurança:</b> o arquivo é tratado como não confiável; nada é executado, com limites de tamanho ({LIMITS.maxBytes / 1048576} MB), entidades ({LIMITS.maxEntities.toLocaleString('pt-BR')}) e tempo ({LIMITS.timeoutMs / 1000} s).</li>
                <li><b>Limites reais:</b> objetos AEC proprietários, proxies, Xrefs não anexadas e fontes SHX podem não ser interpretados. Nesses casos, use EXPLODE/BIND ou salve como DXF no AutoCAD.</li>
                <li>A cena atual só muda na última etapa, e a importação pode ser desfeita.</li>
              </ul>
            </div>
          )}
          {step === 1 && (
            <div>
              {det && <div className={`insight ${det.ok ? '' : 'err'}`}><b>{det.ok ? 'Formato identificado pelo conteúdo:' : 'Arquivo recusado:'}</b> {det.message}</div>}
              {progress && <div className="insight"><span className="spin" aria-hidden /> {progress}</div>}
              {error && det?.ok && <div className="insight err"><b>Falha na leitura:</b> {error}</div>}
              {error && <button className="btn" onClick={() => { setStep(0); setError(null); }}><I.importCad /> Escolher outro arquivo</button>}
              {model && (
                <>
                  <div className="kpis">
                    <div className="kpi"><span>Formato</span><b>{model.format.toUpperCase()}</b><i>{model.versionName} ({model.version})</i></div>
                    <div className="kpi"><span>Entidades lidas</span><b>{model.entities.length.toLocaleString('pt-BR')}</b><i>{model.layers.length} camadas · {model.blocks.length} blocos</i></div>
                    <div className="kpi"><span>Unidade</span><b>{guess?.unit}</b><i>{guess?.confident ? 'declarada no arquivo' : 'estimada: confirme na próxima etapa'}</i></div>
                    <div className="kpi"><span>Extensão do desenho</span><b>{fmt((model.extents.max[0] - model.extents.min[0]) * toM, 1)} × {fmt((model.extents.max[1] - model.extents.min[1]) * toM, 1)} m</b><i>na unidade atual</i></div>
                  </div>
                  {model.warnings.map((w) => <div key={w} className="insight warn small">{w}</div>)}
                  <details className="small"><summary>Tipos de entidade</summary><p>{Object.entries(model.stats).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p></details>
                </>
              )}
            </div>
          )}
          {step === 2 && model && (
            <div className="cad-grid">
              <div>
                <div className="card">
                  <h3><I.ruler width={16} height={16} /> Unidade, escala e orientação</h3>
                  <label className="field"><span>Unidade do desenho</span>
                    <select value={unit} onChange={(e) => setUnit(e.target.value)}>{UNIT_CHOICES.map((u) => <option key={u.id} value={u.id}>{u.id}</option>)}</select>
                  </label>
                  <p className="small muted" style={{ marginTop: 0 }}>{guess?.reason}</p>
                  <label className="field"><span>Orientação da frente da câmara</span>
                    <select value={rotation} onChange={(e) => setRotation(Number(e.target.value))}>
                      <option value={0}>Lado inferior do desenho = frente (0°)</option><option value={180}>Lado superior do desenho = frente (180°)</option>
                    </select>
                  </label>
                  <p className="small muted">Origem e alinhamento são automáticos: o canto da câmara escolhida vira a origem, e o maior lado vira o comprimento. O nível de referência é o piso (0 m).</p>
                </div>
                <div className="card">
                  <h3><I.layers width={16} height={16} /> Camadas ({layers.size}/{model.layers.length})</h3>
                  <div className="btns" style={{ marginBottom: 6 }}>
                    <button className="btn sm" onClick={() => setLayers(new Set(model.layers.map((l) => l.name)))}>Todas</button>
                    <button className="btn sm" onClick={() => setLayers(new Set())}>Nenhuma</button>
                  </div>
                  <div className="layer-list">{model.layers.map((l) => (
                    <label key={l.name} className="check"><input type="checkbox" checked={layers.has(l.name)} onChange={(e) => { const n = new Set(layers); e.target.checked ? n.add(l.name) : n.delete(l.name); setLayers(n); }} />
                      <i className="swatch" style={{ background: CAT_COLOR[mapping[l.name]] }} /> {l.name} <span className="muted">({l.count}){l.off ? ' · desligada' : ''}{l.frozen ? ' · congelada' : ''}</span></label>
                  ))}</div>
                </div>
              </div>
              <CadPlan model={model} layers={layers} mapping={mapping} room={room} />
            </div>
          )}
          {step === 3 && model && rec && (
            <div className="cad-grid">
              <div>
                <div className="card">
                  <h3>Camadas → categorias</h3>
                  <p className="small muted" style={{ marginTop: 0 }}>Sugestões pelo nome da camada (pistas, não provas). Ajuste conforme o desenho.</p>
                  <table className="t small"><tbody>{model.layers.filter((l) => layers.has(l.name)).map((l) => (
                    <tr key={l.name}><td style={{ textAlign: 'left' }}><i className="swatch" style={{ background: CAT_COLOR[mapping[l.name]] }} /> {l.name}</td>
                      <td><select value={mapping[l.name]} onChange={(e) => setMapping({ ...mapping, [l.name]: e.target.value as Category })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></td></tr>
                  ))}</tbody></table>
                </div>
                <div className="card">
                  <h3>Câmara reconhecida</h3>
                  {!rec.rooms.length && <div className="insight warn small">{rec.notes[0] ?? 'Nenhuma câmara reconhecida.'}</div>}
                  {rec.rooms.map((r, i) => (
                    <label key={r.rect.id} className="check" style={{ alignItems: 'flex-start' }}>
                      <input type="radio" name="room" checked={roomIdx === i} onChange={() => setRoomIdx(i)} />
                      <span><b>{fmt(r.lengthM, 2)} × {fmt(r.widthM, 2)} m</b> ({fmt(r.areaM2, 1)} m²) <StatusChip s={r.status} /> <span className="muted">confiança {Math.round(r.confidence * 100)}%</span><br /><span className="small muted">{r.reasons.join(' ')}</span></span>
                    </label>
                  ))}
                  {rec.notes.slice(rec.rooms.length ? 0 : 1).map((n) => <p key={n} className="small muted">{n}</p>)}
                  <Num label="Altura (pé-direito) para extrusão" unit="m" value={height} min={2.2} max={40} step={0.1} onChange={setHeight} hint="Informada pelo usuário: o desenho em planta não define a altura" />
                  {room?.panelMm && <Check label={`Usar painel de ${room.panelMm} mm (parede medida de ${fmt((room.wallThicknessM ?? 0) * 1000, 0)} mm)`} checked={applyPanel} onChange={setApplyPanel} />}
                </div>
                <div className="card">
                  <h3>Portas e aberturas</h3>
                  {!rec.doors.length && <p className="small muted" style={{ margin: 0 }}>Nenhuma abertura identificada junto às paredes da câmara.</p>}
                  {rec.doors.map((d) => (
                    <label key={d.id} className="check"><input type="checkbox" checked={doorSel.has(d.id)} onChange={(e) => { const n = new Set(doorSel); e.target.checked ? n.add(d.id) : n.delete(d.id); setDoorSel(n); }} />
                      <span>{d.wall} · {fmt(d.widthM, 2)} m · posição {Math.round(d.position * 100)}% · {d.type === 'giratoria' ? 'de abrir' : 'de correr/vão'} <StatusChip s={d.status} /><br /><span className="small muted">{d.source}</span></span></label>
                  ))}
                  {rec.doors.length > 0 && <Check label="Substituir as portas atuais do projeto" checked={replaceDoors} onChange={setReplaceDoors} />}
                </div>
                <div className="card">
                  <h3>Equipamentos e demais elementos</h3>
                  {rec.hints.length ? rec.hints.map((h) => <div key={h.id} className="small">{h.label} <StatusChip s="revisar" /></div>) : <p className="small muted" style={{ margin: 0 }}>Nenhum bloco com nome de equipamento.</p>}
                  <p className="small muted">Blocos e nomes de camada servem só de pista: nenhum equipamento é criado automaticamente, e diâmetros, materiais, pressões e capacidades não são inferidos do desenho. Tubulações, textos e cotas ficam como <StatusChip s="referencia" />.</p>
                  {Object.keys(model.unsupported).length > 0 && <div className="small"><StatusChip s="nao-suportado" /> {Object.entries(model.unsupported).map(([k, v]) => `${k} (${v})`).join(', ')}</div>}
                </div>
              </div>
              <CadPlan model={model} layers={layers} mapping={mapping} room={room} doors={doors} hints={rec.hints} />
            </div>
          )}
          {step === 4 && model && preview && (
            <div className="cad-grid">
              <div>
                <div className="seg" style={{ marginBottom: 10 }}>
                  <button className={view === 'planta' ? 'on' : ''} onClick={() => setView('planta')}>Planta 2D</button>
                  <button className={view === 'iso' ? 'on' : ''} onClick={() => setView('iso')}>Vista isométrica</button>
                </div>
                <div className="card">
                  <h3>Antes × depois</h3>
                  <table className="t small"><thead><tr><th>Parâmetro</th><th>Atual</th><th>Importado</th></tr></thead><tbody>
                    <tr><td>Comprimento</td><td>{fmt(s.project.room.areaMode === 'dims' ? s.project.room.length : Math.sqrt(s.project.room.area * s.project.room.aspect), 2)} m</td><td><b>{fmt(preview.room.length, 2)} m</b></td></tr>
                    <tr><td>Largura</td><td>{fmt(s.project.room.areaMode === 'dims' ? s.project.room.width : s.project.room.area / Math.sqrt(s.project.room.area * s.project.room.aspect), 2)} m</td><td><b>{fmt(preview.room.width, 2)} m</b></td></tr>
                    <tr><td>Altura</td><td>{fmt(s.project.room.height, 2)} m</td><td><b>{fmt(preview.room.height, 2)} m</b></td></tr>
                    <tr><td>Painel das paredes</td><td>{s.project.envelope.wallThk} mm</td><td><b>{preview.envelope.wallThk} mm</b></td></tr>
                    <tr><td>Portas</td><td>{s.project.doors.length}</td><td><b>{preview.doors.length}</b></td></tr>
                  </tbody></table>
                  <p className="small muted" style={{ marginBottom: 0 }}>Os demais dados (temperaturas, produto, operação) continuam os do projeto atual e devem ser revisados.</p>
                </div>
                {!room && <div className="insight warn small">Sem câmara reconhecida: só a referência 2D e a altura serão aplicadas; dimensões continuam as atuais.</div>}
              </div>
              {view === 'planta' ? <CadPlan model={model} layers={layers} mapping={mapping} room={room} doors={doors} /> : <div className="cad-plan"><CadIso L={preview.room.length} W={preview.room.width} H={preview.room.height} doors={preview.doors.map((d) => ({ wall: d.wall, position: d.position, width: d.width, height: d.height }))} refSegs={refSegs} /></div>}
            </div>
          )}
          {step === 5 && model && preview && (
            <div>
              <div className="card">
                <h3>Resumo da conversão</h3>
                <ul className="clean small">
                  <li>Arquivo: <b>{model.fileName}</b> ({model.format.toUpperCase()}, {model.versionName}), unidade <b>{unit}</b>, orientação {rotation}°.</li>
                  <li>Camadas importadas: {[...layers].join(', ') || 'nenhuma'}.</li>
                  {Object.entries(preview.cadImport?.provenance ?? {}).map(([k, v]) => <li key={k}><b>{k}</b>: {v}</li>)}
                  <li>Referência 2D: {((preview.cadImport?.ref.length ?? 0) / 4).toLocaleString('pt-BR')} segmentos exibidos no piso da cena 3D.</li>
                </ul>
                <Check label="Confirmo que as dimensões importadas correspondem à instalação (eleva a qualidade da estimativa)" checked={confirmDims} onChange={setConfirmDims} />
                {model.warnings.length > 0 && <details className="small"><summary>{model.warnings.length} aviso(s) da leitura</summary><ul className="clean">{model.warnings.map((w) => <li key={w}>{w}</li>)}</ul></details>}
              </div>
              <div className="btns">
                <button className="btn primary" onClick={() => finish('aplicar')}><I.check /> Aplicar ao projeto</button>
                <button className="btn" onClick={() => finish('comparar')}><I.compare /> Abrir como cenário B (comparar antes/depois)</button>
              </div>
              <p className="small muted">Após aplicar, Desfazer (Ctrl+Z) restaura o cenário anterior. O projeto importado pode ser salvo, exportado em JSON e usado nos relatórios PDF.</p>
            </div>
          )}
        </div>
        <div className="wizard-foot">
          <span className="legend-inline small">
            <StatusChip s="reconhecido" /> <StatusChip s="revisar" /> <StatusChip s="nao-suportado" /> <StatusChip s="referencia" />
          </span>
          <span className="spacer" />
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button>
          {step < 5 && <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Avançar <I.chevron /></button>}
        </div>
      </div>
    </div>
  );
}
