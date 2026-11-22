import { useState } from 'react';
import { useActiveProject, useStore } from '../../state/store';
import { useEvaluation } from '../../state/useEvaluation';
import { APPLICATIONS, DEMOS, makeDoor, projectFor } from '../../data/scenarios';
import { PRODUCTS, PACKAGING, productById, productProps } from '../../data/products';
import { INSULATIONS, PANEL_THICKNESSES, SOLAR, DOOR_PROTECTION, DOOR_TYPES, insulationById, type SolarKey, type ProtectionKey, type DoorTypeId } from '../../data/materials';
import { ARCHITECTURES, type Architecture } from '../../engine/cycle';
import { QUALITY_INFO } from '../../engine/analysis';
import type { ConfirmKey, Door, Wall } from '../../engine/types';
import { Check, Num, OriginChip, Select, Slider, Term, fmt, sig } from '../../ui/common';
import { I } from '../../ui/Icons';
import Results from './Results';
import Equipment from './Equipment';
import CompareFinance from './CompareFinance';
import Report from './Report';

const STEPS = ['Aplicação', 'Dimensões', 'Produtos', 'Portas', 'Isolamento', 'Operação', 'Resultados', 'Equipamentos', 'Comparar', 'Relatório'];

export default function Commercial() {
  const [step, setStep] = useState(0);
  const p = useActiveProject();
  const editing = useStore((s) => s.editing);
  const scenarioB = useStore((s) => s.scenarioB);
  const setEditing = useStore((s) => s.setEditing);
  const ev = useEvaluation();
  return (
    <div>
      <div className="card dark" style={{ position: 'sticky', top: -12, zIndex: 2 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small muted">{p.name}{scenarioB && <> · editando <span className={`ab ${editing.toLowerCase()}`}>{editing}</span></>}</span>
          <span className={`chip q-${ev.quality}`}>{QUALITY_INFO[ev.quality].label}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>
          {ev.cycle.errors.length ? 'Sem cálculo válido' : <>{fmt0s(ev.range[0])} a {fmt0s(ev.range[1])} kW</>}
        </div>
        <div className="small muted">Capacidade frigorífica preliminar · nominal de {fmt(sig(ev.loads.nominal.requiredKW, 3), 0)} kW ({fmt(ev.loads.nominal.requiredKW / 3.517, 0)} TR)</div>
        {scenarioB && <div className="btns" style={{ marginTop: 8 }}>{(['A', 'B'] as const).map((k) => <button key={k} className={`btn sm ${editing === k ? 'primary' : ''}`} onClick={() => setEditing(k)}>Editar cenário {k}</button>)}</div>}
      </div>
      <nav className="steps" aria-label="Etapas">{STEPS.map((s, i) => <button key={s} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => setStep(i)}>{i + 1}. {s}</button>)}</nav>
      {step === 0 && <StepApp />}
      {step === 1 && <StepDims />}
      {step === 2 && <StepProduct />}
      {step === 3 && <StepDoors />}
      {step === 4 && <StepInsulation />}
      {step === 5 && <StepOperation />}
      {step === 6 && <Results />}
      {step === 7 && <Equipment />}
      {step === 8 && <CompareFinance />}
      {step === 9 && <Report />}
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Voltar</button>
        {step < STEPS.length - 1 && <button className="btn primary" onClick={() => setStep(step + 1)}>{step === 5 ? 'Ver resultados' : 'Avançar'} <I.chevron /></button>}
      </div>
    </div>
  );
}
const fmt0s = (v: number) => fmt(sig(v, 2), 0);

function Confirm({ k, label = 'Confirmo que os dados desta etapa refletem a instalação real' }: { k: ConfirmKey; label?: string }) {
  const p = useActiveProject();
  const up = useStore((s) => s.update);
  return <div className="card" style={{ background: 'var(--bg)' }}><Check label={label} checked={!!p.confirmed[k]} onChange={(v) => up((q) => { q.confirmed[k] = v; })} /><div className="small muted">Etapas confirmadas elevam a qualidade da estimativa (exploratória → preliminar → detalhada) e reduzem a faixa de incerteza.</div></div>;
}

function StepApp() {
  const p = useActiveProject();
  const s = useStore();
  return (
    <div>
      <h3 style={{ fontSize: 17, margin: '4px 0 10px' }}>O que você precisa refrigerar?</h3>
      <div className="app-grid">
        {APPLICATIONS.map((a) => (
          <button key={a.id} className={p.application === a.id ? 'on' : ''} onClick={() => {
            const n = projectFor(a.id, p.name.startsWith('Demo') ? a.name : p.name);
            n.finance = p.finance;
            s.update((q) => Object.assign(q, n));
            s.goCamera('geral');
          }}><b>{a.name}</b><span>{a.desc}</span></button>
        ))}
      </div>
      <p className="small muted">Cada aplicação carrega parâmetros iniciais <OriginChip o="hipotese" />. São sugestões para começar, e todos os valores podem ser editados nas próximas etapas.</p>
      <label className="field"><span>Nome do projeto</span><input value={p.name} onChange={(e) => s.update((q) => { q.name = e.target.value; }, 'name')} /></label>
      <h4 style={{ margin: '12px 0 6px' }}>Ou carregue um exemplo completo</h4>
      <div className="btns">{DEMOS.map((d) => <button key={d.id} className="btn sm" title={d.desc} onClick={() => s.setProject(d.build())}>{d.title}</button>)}</div>
    </div>
  );
}

function StepDims() {
  const p = useActiveProject();
  const up = useStore((s) => s.update);
  const ev = useEvaluation();
  const g = ev.loads.nominal.geometry;
  if (p.application === 'agua-gelada') return (
    <div>
      <div className="card"><h3>Processo com água gelada</h3>
        <div className="grid2">
          <Num label="Vazão de água" unit="m³/h" value={p.process.flow} min={0.1} max={2000} onChange={(v) => up((q) => { q.process.flow = v; }, 'pf')} />
          <Num label="Horas de consumo por dia" unit="h" value={p.process.hoursPerDay} min={0.5} max={24} onChange={(v) => up((q) => { q.process.hoursPerDay = v; }, 'ph')} />
          <Num label="Temperatura de retorno" unit="°C" value={p.process.Tin} min={2} max={60} onChange={(v) => up((q) => { q.process.Tin = v; }, 'pti')} />
          <Num label="Temperatura de água gelada" unit="°C" value={p.process.Tout} min={0.5} max={20} onChange={(v) => up((q) => { q.process.Tout = v; }, 'pto')} />
        </div>
        <Select label="Estratégia" value={p.process.strategy} onChange={(v) => up((q) => { q.process.strategy = v; })} options={[{ value: 'banco-gelo', label: 'Banco de gelo (acumulação)' }, { value: 'chiller', label: 'Chiller direto (trocador a placas)' }]} />
      </div>
      <Climate />
      <Confirm k="temperaturas" label="Confirmo vazão, temperaturas e regime de consumo" />
    </div>
  );
  return (
    <div>
      <div className="card">
        <h3>Geometria da câmara<span className="spacer" /><button className="btn sm" onClick={() => useStore.getState().setModal('importarCad')}><I.importCad /> Importar de DWG/DXF</button></h3>
        {p.cadImport && <p className="small muted" style={{ marginTop: 0 }}>Geometria importada de <b>{p.cadImport.fileName}</b> ({p.cadImport.format.toUpperCase()}, {p.cadImport.unit}). Campos importados: {Object.keys(p.cadImport.provenance).join(', ')}.</p>}
        <div className="seg" style={{ marginBottom: 10 }}>
          <button className={p.room.areaMode === 'dims' ? 'on' : ''} onClick={() => up((q) => { q.room.areaMode = 'dims'; q.room.length = g.L; q.room.width = g.W; })}>Comprimento × largura</button>
          <button className={p.room.areaMode === 'area' ? 'on' : ''} onClick={() => up((q) => { q.room.areaMode = 'area'; q.room.area = Math.round(g.floor); q.room.aspect = Math.round((g.L / g.W) * 10) / 10; })}>Área + proporção</button>
        </div>
        {p.room.areaMode === 'dims' ? (
          <div className="grid2">
            <Num label="Comprimento" unit="m" value={round(p.room.length)} min={2} max={200} step={0.5} onChange={(v) => up((q) => { q.room.length = v; }, 'L')} />
            <Num label="Largura" unit="m" value={round(p.room.width)} min={2} max={150} step={0.5} onChange={(v) => up((q) => { q.room.width = v; }, 'W')} />
          </div>
        ) : (
          <div className="grid2">
            <Num label="Área de piso" unit="m²" value={p.room.area} min={4} max={30000} onChange={(v) => up((q) => { q.room.area = v; }, 'A')} />
            <Num label="Proporção C/L" value={p.room.aspect} min={1} max={6} step={0.1} hint="Proporção aproximada usada para construir a geometria 3D" onChange={(v) => up((q) => { q.room.aspect = v; }, 'asp')} />
          </div>
        )}
        <div className="grid2">
          <Num label="Altura interna" unit="m" value={p.room.height} min={2.2} max={40} step={0.1} hint="Necessária para o volume" onChange={(v) => up((q) => { q.room.height = v; }, 'H')} />
          <Num label="Quantidade de câmaras iguais" value={p.room.count} min={1} max={50} onChange={(v) => up((q) => { q.room.count = Math.round(v); }, 'n')} />
        </div>
        <div className="kpis">
          <div className="kpi"><span>Área</span><b>{fmt(g.floor, 0)} m²</b><i>{fmt(g.L, 1)} × {fmt(g.W, 1)} m</i></div>
          <div className="kpi"><span>Volume</span><b>{fmt(g.volume, 0)} m³</b><i>por câmara</i></div>
        </div>
      </div>
      <div className="card">
        <h3>Temperaturas internas</h3>
        <div className="grid2">
          <Num label="Temperatura interna" unit="°C" value={p.room.Tin} min={-45} max={20} step={0.5} onChange={(v) => up((q) => { q.room.Tin = v; }, 'Tin')} />
          <Num label="Umidade relativa interna" unit="%" value={Math.round(p.room.RHin * 100)} min={30} max={98} onChange={(v) => up((q) => { q.room.RHin = v / 100; }, 'RHin')} />
        </div>
      </div>
      <Climate />
      <Confirm k="dimensoes" label="Confirmo as dimensões e a quantidade de câmaras" />
      <Confirm k="temperaturas" label="Confirmo a temperatura e a umidade internas" />
    </div>
  );
}
const round = (v: number) => Math.round(v * 10) / 10;

function Climate() {
  const p = useActiveProject();
  const up = useStore((s) => s.update);
  const ev = useEvaluation();
  return (
    <div className="card">
      <h3>Clima de projeto e localização</h3>
      <label className="field"><span>Localidade / referência climática</span><input value={p.climate.label} onChange={(e) => up((q) => { q.climate.label = e.target.value; }, 'cl')} /></label>
      <div className="grid2">
        <Num label="Temperatura externa (bulbo seco)" unit="°C" value={p.climate.Tout} min={-10} max={48} step={0.5} onChange={(v) => up((q) => { q.climate.Tout = v; }, 'Tout')} />
        <Num label="Umidade relativa externa" unit="%" value={Math.round(p.climate.RHout * 100)} min={10} max={100} onChange={(v) => up((q) => { q.climate.RHout = v / 100; }, 'RH')} />
      </div>
      <div className="small muted">Bulbo úmido calculado: <b>{fmt(ev.temps.twb, 1)} °C</b> (psicrometria ASHRAE), que define a condensação no condensador evaporativo. Para o projeto, use os dados climáticos de projeto do local (ex.: ASHRAE Climatic Design Conditions, 0,4%).</div>
      <Check label="Confirmo as condições climáticas de projeto" checked={!!p.confirmed.clima} onChange={(v) => up((q) => { q.confirmed.clima = v; })} />
    </div>
  );
}

function StepProduct() {
  const p = useActiveProject();
  const up = useStore((s) => s.update);
  const prod = productById(p.product.typeId);
  const pp = productProps(prod);
  if (p.application === 'agua-gelada') return <p className="muted">No processo com água gelada, a carga vem da vazão e das temperaturas informadas na etapa 2.</p>;
  return (
    <div>
      <div className="card">
        <h3>Produto armazenado</h3>
        <Select label="Tipo de produto" value={p.product.typeId} onChange={(v) => up((q) => { q.product.typeId = v; })} options={PRODUCTS.map((x) => ({ value: x.id, label: x.name }))} />
        <div className="small" style={{ marginBottom: 8 }}>
          Teor de água {fmt(prod.water * 100, 0)}% · congelamento inicial {prod.tFreeze === null ? 'não se aplica' : `${prod.tFreeze} °C`} · <Term id="calor-sensivel">cp</Term> {fmt(pp.cpAbove, 2)} / {fmt(pp.cpBelow, 2)} kJ/kg·K · <Term id="calor-latente">latente</Term> {fmt(pp.latent, 0)} kJ/kg <OriginChip o="referencia" />
          {prod.note && <div className="muted">{prod.note}</div>}
        </div>
        <div className="grid2">
          <Num label="Massa armazenada" unit="kg" value={p.product.storedMass} min={0} max={1e8} onChange={(v) => up((q) => { q.product.storedMass = v; }, 'sm')} />
          <Num label="Massa recebida por dia" unit="kg/dia" value={p.product.dailyMass} min={0} max={1e7} onChange={(v) => up((q) => { q.product.dailyMass = v; }, 'dm')} />
          <Num label="Temperatura de entrada" unit="°C" value={p.product.Tenter} min={-40} max={80} step={0.5} onChange={(v) => up((q) => { q.product.Tenter = v; }, 'te')} />
          <Num label="Temperatura final desejada" unit="°C" value={p.product.Tfinal} min={-45} max={30} step={0.5} onChange={(v) => up((q) => { q.product.Tfinal = v; }, 'tf')} />
          <Num label="Tempo para resfriar/congelar" unit="h" value={p.product.coolingHours} min={0.5} max={72} step={0.5} onChange={(v) => up((q) => { q.product.coolingHours = v; }, 'ch')} />
          <Num label="Rotatividade do estoque" unit="dias" value={p.product.turnoverDays} min={0.5} max={365} onChange={(v) => up((q) => { q.product.turnoverDays = v; }, 'to')} />
        </div>
        {p.product.Tfinal < (prod.tFreeze ?? -99) && p.product.Tenter > (prod.tFreeze ?? -99) && <div className="insight">O produto <b>congela</b> neste processo: a carga inclui o calor latente de congelamento ({fmt(pp.latent, 0)} kJ/kg).</div>}
        {p.product.Tfinal < p.room.Tin && <div className="insight warn">A temperatura final do produto está abaixo da temperatura da câmara ({p.room.Tin} °C). Isso não é fisicamente alcançável apenas com o ar da câmara.</div>}
        {p.product.dailyMass * p.product.turnoverDays > p.product.storedMass * 1.5 && p.product.storedMass > 0 && <div className="insight warn">A massa diária × rotatividade ({fmt(p.product.dailyMass * p.product.turnoverDays / 1000, 0)} t) excede bastante a massa armazenada informada. Confira os dados.</div>}
      </div>
      <div className="card">
        <h3>Embalagens e movimentação</h3>
        <div className="grid2">
          <Select label="Embalagem" value={p.product.packaging} onChange={(v) => up((q) => { q.product.packaging = v; })} options={PACKAGING.map((x) => ({ value: x.id, label: x.name }))} />
          <Num label="Massa de embalagem" unit="% do produto" value={Math.round(p.product.packagingFraction * 100)} min={0} max={50} onChange={(v) => up((q) => { q.product.packagingFraction = v / 100; }, 'pk')} />
        </div>
      </div>
      <Confirm k="produto" />
    </div>
  );
}

function StepDoors() {
  const p = useActiveProject();
  const up = useStore((s) => s.update);
  const ev = useEvaluation();
  const setView = useStore((s) => s.setView);
  const doorsOpen = useStore((s) => s.view.doorsOpen);
  const det = Object.fromEntries(ev.loads.nominal.doorDetails.map((d) => [d.id, d]));
  const upd = (id: string, fn: (d: Door) => void, tag?: string) => up((q) => { const d = q.doors.find((x) => x.id === id); if (d) fn(d); }, tag ? tag + id : undefined);
  if (p.application === 'agua-gelada') return <p className="muted">Não se aplica ao processo com água gelada.</p>;
  const infl = ev.breakdown.find((b) => b.key === 'infiltracao');
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="small">Infiltração total: <b>{fmt((infl?.kWhDay ?? 0) / 24, 1)} kW médios</b> ({fmt((infl?.share ?? 0) * 100, 0)}% da carga)</div>
        <button className="btn sm" onClick={() => setView({ doorsOpen: !doorsOpen })}><I.door /> {doorsOpen ? 'Fechar' : 'Abrir'} no 3D</button>
      </div>
      {p.doors.map((d, i) => (
        <div key={d.id} className="door-item">
          <div className="row"><b>Porta {i + 1}</b><span className="small muted">{det[d.id] ? `${fmt(det[d.id].kW, 2)} kW médios · aberta ${fmt(det[d.id].Dt * 100, 1)}% do tempo` : ''}</span>
            <button className="ib" aria-label="Remover porta" onClick={() => up((q) => { q.doors = q.doors.filter((x) => x.id !== d.id); })}><I.trash /></button></div>
          <Select label="Tipo (linha Engefril)" value={d.type} onChange={(v: DoorTypeId) => upd(d.id, (x) => { x.type = v; if (v === 'portinhola') { x.width = Math.min(x.width, 1); x.height = Math.min(x.height, 1); } if (v === 'seccional') { x.width = Math.max(x.width, 2.4); x.height = Math.max(x.height, 2.8); } })} options={DOOR_TYPES.map((t) => ({ value: t.id, label: t.name }))} />
          <div className="grid3">
            <Num label="Largura" unit="m" value={d.width} min={0.4} max={6} step={0.1} onChange={(v) => upd(d.id, (x) => { x.width = v; }, 'w')} />
            <Num label="Altura" unit="m" value={d.height} min={0.4} max={Math.min(8, p.room.height)} step={0.1} onChange={(v) => upd(d.id, (x) => { x.height = v; }, 'h')} />
            <Num label="Quantidade" value={d.count} min={1} max={20} onChange={(v) => upd(d.id, (x) => { x.count = Math.round(v); }, 'c')} />
          </div>
          <div className="grid2">
            <Select label="Parede" value={d.wall} onChange={(v: Wall) => upd(d.id, (x) => { x.wall = v; })} options={[{ value: 'frente', label: 'Frente' }, { value: 'fundo', label: 'Fundo' }, { value: 'esquerda', label: 'Esquerda (sala de máquinas)' }, { value: 'direita', label: 'Direita' }]} />
            <Select label="Tráfego" value={d.traffic} onChange={(v: Door['traffic']) => upd(d.id, (x) => { x.traffic = v; x.secondsPerPassage = v === 'pessoas' ? 8 : v === 'paleteira' ? 20 : 25; })} options={[{ value: 'pessoas', label: 'Pessoas' }, { value: 'paleteira', label: 'Paleteiras' }, { value: 'empilhadeira', label: 'Empilhadeiras' }]} />
          </div>
          <Slider label="Posição na parede" min={0} max={1} step={0.01} value={d.position} onChange={(v) => upd(d.id, (x) => { x.position = v; }, 'pos')} format={(x) => `${Math.round(x * 100)}%`} />
          <div className="grid2">
            <Num label="Passagens por hora" unit="/h" value={d.passagesPerHour} min={0} max={200} onChange={(v) => upd(d.id, (x) => { x.passagesPerHour = v; }, 'pph')} />
            <Num label="Horas de operação/dia" unit="h" value={d.hoursPerDay} min={0} max={24} onChange={(v) => upd(d.id, (x) => { x.hoursPerDay = v; }, 'hpd')} />
            <Num label="Abrir + fechar por passagem" unit="s" value={d.secondsPerPassage} min={2} max={300} onChange={(v) => upd(d.id, (x) => { x.secondsPerPassage = v; }, 'spp')} />
            <Num label="Tempo simplesmente aberta" unit="min/h" value={d.minutesOpenPerHour} min={0} max={60} onChange={(v) => upd(d.id, (x) => { x.minutesOpenPerHour = v; }, 'mo')} />
            <Num label="Temperatura do lado externo" unit="°C" value={d.adjacentT} min={-40} max={50} step={0.5} onChange={(v) => upd(d.id, (x) => { x.adjacentT = v; }, 'at')} />
            <Num label="Umidade do lado externo" unit="%" value={Math.round(d.adjacentRH * 100)} min={10} max={100} onChange={(v) => upd(d.id, (x) => { x.adjacentRH = v / 100; }, 'arh')} />
          </div>
          <Select label="Proteção da abertura" value={d.protection} onChange={(v: ProtectionKey) => upd(d.id, (x) => { x.protection = v; })} options={(Object.keys(DOOR_PROTECTION) as ProtectionKey[]).map((k) => ({ value: k, label: `${DOOR_PROTECTION[k].name}${DOOR_PROTECTION[k].E ? ` (E ≈ ${Math.round(DOOR_PROTECTION[k].range[0] * 100)}–${Math.round(DOOR_PROTECTION[k].range[1] * 100)}%)` : ''}` }))} />
          <Check label="Vedação em bom estado" checked={d.sealGood} onChange={(v) => upd(d.id, (x) => { x.sealGood = v; })} />
        </div>
      ))}
      <button className="btn" onClick={() => up((q) => { q.doors.push(makeDoor({ adjacentT: q.climate.Tout, adjacentRH: q.climate.RHout, position: Math.random() * 0.6 + 0.2 })); })}><I.plus /> Adicionar porta</button>
      <div className="card" style={{ marginTop: 10 }}>
        <h3>Metodologia</h3>
        <p className="small" style={{ margin: 0 }}>A infiltração é calculada pelo método de Gosney & Olama (ASHRAE Refrigeration, cap. 24). Ela depende da área e da altura da porta, da diferença de densidade e de entalpia entre o ar externo e o interno (temperatura e umidade), da fração de tempo aberta (Dt), do fator de fluxo (Df = 0,7 a 1,1) e da efetividade da proteção (E). Não é um acréscimo percentual por porta. As faixas de Df e E geram o intervalo de incerteza dos resultados. <OriginChip o="referencia" /></p>
      </div>
      <Confirm k="portas" />
    </div>
  );
}

function StepInsulation() {
  const p = useActiveProject();
  const up = useStore((s) => s.update);
  const ev = useEvaluation();
  const ins = insulationById(p.envelope.insulation);
  if (p.application === 'agua-gelada') return <p className="muted">O tanque de água gelada Engefril usa painéis de 100 mm <OriginChip o="oficial" />. Neste modelo simplificado, as perdas do tanque não são calculadas.</p>;
  const tr = ev.breakdown.find((b) => b.key === 'transmissao');
  return (
    <div>
      <div className="card">
        <h3>Painéis e isolante</h3>
        <Select label="Material do núcleo" value={p.envelope.insulation} onChange={(v) => up((q) => { q.envelope.insulation = v; })} options={INSULATIONS.map((x) => ({ value: x.id, label: x.name }))} />
        <div className="small muted" style={{ marginBottom: 8 }}>{ins.note} <OriginChip o={ins.origin} /></div>
        <div className="grid3">
          <Select label="Paredes (mm)" value={String(p.envelope.wallThk)} onChange={(v) => up((q) => { q.envelope.wallThk = Number(v); })} options={PANEL_THICKNESSES.map((t) => ({ value: String(t), label: `${t} mm` }))} />
          <Select label="Teto (mm)" value={String(p.envelope.roofThk)} onChange={(v) => up((q) => { q.envelope.roofThk = Number(v); })} options={PANEL_THICKNESSES.map((t) => ({ value: String(t), label: `${t} mm` }))} />
          <Select label="Piso (mm)" value={String(p.envelope.floorThk)} onChange={(v) => up((q) => { q.envelope.floorThk = Number(v); })} options={PANEL_THICKNESSES.map((t) => ({ value: String(t), label: `${t} mm` }))} />
        </div>
        <Check label="Piso isolado" checked={p.envelope.floorInsulated} onChange={(v) => up((q) => { q.envelope.floorInsulated = v; })} />
        <div className="grid2">
          <Num label={<>Condutividade <Term id="lambda">λ</Term> própria (opcional)</>} unit="W/m·K" value={p.envelope.lambdaOverride ?? 0} min={0} max={0.1} step={0.001} hint="0 = usar a faixa típica do material" onChange={(v) => up((q) => { q.envelope.lambdaOverride = v > 0 ? v : null; }, 'lam')} />
          <Num label="Pontes térmicas" unit="%" value={p.envelope.thermalBridgePct} min={0} max={40} onChange={(v) => up((q) => { q.envelope.thermalBridgePct = v; }, 'tb')} />
        </div>
        <div className="kpis">
          <div className="kpi"><span><Term id="u">U</Term> das paredes</span><b>{fmt(ev.loads.nominal.U.wall, 3)}</b><i>W/m²·K</i></div>
          <div className="kpi"><span>Transmissão</span><b>{fmt((tr?.kWhDay ?? 0) / 24, 1)} kW</b><i>{fmt((tr?.share ?? 0) * 100, 0)}% da carga</i></div>
        </div>
      </div>
      <div className="card">
        <h3>Condições externas do envelope</h3>
        <div className="grid2">
          <Select label="Exposição solar das paredes" value={p.climate.solarWalls} onChange={(v: SolarKey) => up((q) => { q.climate.solarWalls = v; })} options={(Object.keys(SOLAR) as SolarKey[]).map((k) => ({ value: k, label: SOLAR[k].name }))} />
          <Select label="Exposição solar do teto" value={p.climate.solarRoof} onChange={(v: SolarKey) => up((q) => { q.climate.solarRoof = v; })} options={(Object.keys(SOLAR) as SolarKey[]).map((k) => ({ value: k, label: SOLAR[k].name }))} />
        </div>
        <Num label="Temperatura sob o piso (solo ou aquecimento)" unit="°C" value={p.climate.Tground} min={-5} max={35} step={0.5} hint="Câmaras de congelados exigem aquecimento sob o piso para evitar congelamento do solo" onChange={(v) => up((q) => { q.climate.Tground = v; }, 'tg')} />
        {p.room.Tin < 0 && !p.envelope.floorInsulated && <div className="insight err">Câmaras abaixo de 0 °C exigem piso isolado e aquecido: o congelamento do solo pode levantar a laje.</div>}
        <p className="small muted" style={{ margin: 0 }}>A espessura correta depende da aplicação, da temperatura e de requisitos técnicos e normativos (condensação superficial, barreira de vapor, segurança contra incêndio). Use o comparador de cenários para avaliar outras espessuras.</p>
      </div>
      <Confirm k="isolamento" />
    </div>
  );
}

function StepOperation() {
  const p = useActiveProject();
  const up = useStore((s) => s.update);
  const sys = p.system;
  return (
    <div>
      {p.application !== 'agua-gelada' && (
        <div className="card">
          <h3>Cargas internas</h3>
          <div className="grid2">
            <Num label="Pessoas" value={p.internal.people} min={0} max={500} onChange={(v) => up((q) => { q.internal.people = v; }, 'pp')} />
            <Num label="Horas/dia com pessoas" unit="h" value={p.internal.peopleHours} min={0} max={24} onChange={(v) => up((q) => { q.internal.peopleHours = v; }, 'ph')} />
            <Num label="Iluminação" unit="W/m²" value={p.internal.lightingWm2} min={0} max={40} step={0.5} onChange={(v) => up((q) => { q.internal.lightingWm2 = v; }, 'lw')} />
            <Num label="Horas/dia de iluminação" unit="h" value={p.internal.lightingHours} min={0} max={24} onChange={(v) => up((q) => { q.internal.lightingHours = v; }, 'lh')} />
            <Num label="Empilhadeiras e motores" unit="kW" value={p.internal.equipmentKW} min={0} max={2000} step={0.5} onChange={(v) => up((q) => { q.internal.equipmentKW = v; }, 'ek')} />
            <Num label="Horas/dia de equipamentos" unit="h" value={p.internal.equipmentHours} min={0} max={24} onChange={(v) => up((q) => { q.internal.equipmentHours = v; }, 'eh')} />
            <Num label="Outras cargas contínuas" unit="kW" value={p.internal.otherKW} min={0} max={5000} step={0.5} onChange={(v) => up((q) => { q.internal.otherKW = v; }, 'ok')} />
          </div>
          <Check label="Confirmo ocupação, iluminação e equipamentos" checked={!!p.confirmed.internas} onChange={(v) => up((q) => { q.confirmed.internas = v; })} />
        </div>
      )}
      <div className="card">
        <h3>Sistema e operação</h3>
        {p.application !== 'agua-gelada' && <Select label="Arquitetura de refrigeração" value={sys.architecture} onChange={(v: Architecture) => up((q) => { q.system.architecture = v; })} options={ARCHITECTURES.map((a) => ({ value: a.id, label: a.name }))} />}
        <div className="small muted" style={{ marginBottom: 8 }}>{ARCHITECTURES.find((a) => a.id === sys.architecture)?.desc}</div>
        <div className="grid2">
          <Num label="Operação do compressor" unit="h/dia" value={sys.runHours} min={8} max={24} hint="ASHRAE: 16 a 20 h/dia é usual, com folga para degelo e picos" onChange={(v) => up((q) => { q.system.runHours = v; }, 'rh')} />
          <Num label="Fator de segurança" unit="%" value={Math.round(sys.safetyFactor * 100)} min={0} max={30} hint="ASHRAE sugere cerca de 10%" onChange={(v) => up((q) => { q.system.safetyFactor = v / 100; }, 'sf')} />
          {p.application !== 'agua-gelada' && <Select label={<Term id="degelo">Degelo</Term>} value={sys.defrost} onChange={(v: typeof sys.defrost) => up((q) => { q.system.defrost = v; })} options={[{ value: 'ar', label: 'Natural por ar (> 0 °C)' }, { value: 'agua', label: 'Água' }, { value: 'gas-quente', label: 'Gás quente' }, { value: 'eletrico', label: 'Elétrico' }, { value: 'nenhum', label: 'Sem degelo' }]} />}
          {p.application !== 'agua-gelada' && <Num label="TD ar–evaporação" unit="K" value={sys.evapTD} min={3} max={15} step={0.5} onChange={(v) => up((q) => { q.system.evapTD = v; }, 'td')} />}
          <Num label="Aproximação ao bulbo úmido" unit="K" value={sys.condApproach} min={5} max={20} step={0.5} onChange={(v) => up((q) => { q.system.condApproach = v; }, 'ca')} />
          <Num label="Eficiência isentrópica" unit="%" value={Math.round(sys.etaIs * 100)} min={40} max={95} onChange={(v) => up((q) => { q.system.etaIs = v / 100; }, 'eta')} />
        </div>
        {sys.defrost === 'ar' && p.room.Tin <= 0 && <div className="insight warn">Degelo natural por ar só funciona com o ambiente acima de 0 °C (a Engefril o indica para evaporadores de passo 5 mm nessa condição).</div>}
        <details className="small"><summary>Hipóteses do modelo (editáveis)</summary>
          <div className="grid2" style={{ marginTop: 8 }}>
            <Num label="Δp dos ventiladores" unit="Pa" value={sys.fanDp} min={50} max={600} onChange={(v) => up((q) => { q.system.fanDp = v; }, 'fdp')} />
            <Num label="η dos ventiladores" unit="%" value={Math.round(sys.fanEta * 100)} min={20} max={80} onChange={(v) => up((q) => { q.system.fanEta = v / 100; }, 'fe')} />
            <Num label="ΔT do ar na serpentina" unit="K" value={sys.airDT} min={1} max={10} step={0.5} onChange={(v) => up((q) => { q.system.airDT = v; }, 'adt')} />
            <Num label="Eficiência do degelo" unit="%" value={Math.round(sys.defrostEff * 100)} min={10} max={90} onChange={(v) => up((q) => { q.system.defrostEff = v / 100; }, 'de')} />
            <Num label="Auxiliares do condensador" unit="% de Qc" value={sys.condAuxPct} min={0} max={8} step={0.1} onChange={(v) => up((q) => { q.system.condAuxPct = v; }, 'cax')} />
            <Num label="Resistência dos marcos (congelados)" unit="W/m" value={sys.frameHeaterWm} min={0} max={150} onChange={(v) => up((q) => { q.system.frameHeaterWm = v; }, 'fh')} />
            <Num label="Superaquecimento" unit="K" value={sys.superheat} min={0} max={20} step={0.5} onChange={(v) => up((q) => { q.system.superheat = v; }, 'sh')} />
            <Num label="Sub-resfriamento" unit="K" value={sys.subcool} min={0} max={15} step={0.5} onChange={(v) => up((q) => { q.system.subcool = v; }, 'sc')} />
          </div>
          <p className="muted">Hipóteses demonstrativas <OriginChip o="hipotese" />: substitua por dados de projeto e de fabricantes quando disponíveis.</p>
        </details>
      </div>
      <div className="card">
        <h3>Energia</h3>
        <div className="grid2">
          <Num label="Tarifa de energia" unit="R$/kWh" value={p.finance.tariff} min={0} max={5} step={0.01} hint="Informada pelo cliente" onChange={(v) => up((q) => { q.finance.tariff = v; }, 'tar')} />
          <Num label="Dias de operação por ano" unit="dias" value={p.finance.operatingDays} min={1} max={366} onChange={(v) => up((q) => { q.finance.operatingDays = v; }, 'od')} />
        </div>
      </div>
      <Confirm k="operacao" label="Confirmo o regime de operação, o degelo e a tarifa" />
    </div>
  );
}
