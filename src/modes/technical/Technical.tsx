import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { useTechCycle, useEvaluationA } from '../../state/useEvaluation';
import { ARCHITECTURES, computeCycle, VALID, type Architecture } from '../../engine/cycle';
import { satT, tSat } from '../../engine/r717';
import { EnergyBalance, PhDiagram, TsDiagram } from '../../ui/Charts';
import { Check, OriginChip, Seg, Select, Slider, Term, fmt } from '../../ui/common';
import { I } from '../../ui/Icons';

export default function Technical() {
  const [tab, setTab] = useState<'param' | 'diag' | 'desemp' | 'arq' | 'lib'>('param');
  return (
    <div>
      <div className="tabs">{([['param', 'Parâmetros'], ['diag', 'Diagramas'], ['desemp', 'Desempenho'], ['arq', 'Arquiteturas'], ['lib', 'Biblioteca']] as const).map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <Controls />
      {tab === 'param' && <Params />}
      {tab === 'diag' && <Diagrams />}
      {tab === 'desemp' && <Performance />}
      {tab === 'arq' && <Architectures />}
      {tab === 'lib' && <Lib />}
    </div>
  );
}

function Controls() {
  const t = useStore((s) => s.tech);
  const set = useStore((s) => s.setTech);
  const up = useStore((s) => s.update);
  const ev = useEvaluationA();
  const c = useTechCycle();
  return (
    <div className="card">
      <h3>Laboratório <span className="spacer" /><Seg value={t.pUnit} onChange={(pUnit) => set({ pUnit })} options={[{ value: 'kPa', label: 'kPa' }, { value: 'bar', label: 'bar' }]} /> <Seg value={t.tUnit} onChange={(tUnit) => set({ tUnit })} options={[{ value: 'C', label: '°C' }, { value: 'K', label: 'K' }]} /></h3>
      <Check label="Usar as condições do projeto atual (modo comercial)" checked={t.fromProject} onChange={(fromProject) => set({ fromProject, ...(fromProject ? {} : { Te: Math.round(ev.temps.Te), Tc: Math.round(ev.temps.Tc), capacity: Math.round(ev.loads.nominal.requiredKW) }) })} />
      {!t.fromProject ? (
        <>
          <Select label="Arquitetura" value={t.architecture} onChange={(architecture: Architecture) => { set({ architecture }); up((q) => { q.system.architecture = architecture; }); }} options={ARCHITECTURES.map((a) => ({ value: a.id, label: a.name }))} />
          <Slider label={<>Temperatura de evaporação</>} min={VALID.TeMin} max={VALID.TeMax} step={1} value={t.Te} onChange={(Te) => set({ Te })} format={(v) => `${v} °C · ${fmt(satT(v).P / (t.pUnit === 'bar' ? 100 : 1), t.pUnit === 'bar' ? 2 : 0)} ${t.pUnit}`} />
          <Slider label="Temperatura de condensação" min={VALID.TcMin} max={VALID.TcMax} step={1} value={t.Tc} onChange={(Tc) => set({ Tc })} format={(v) => `${v} °C · ${fmt(satT(v).P / (t.pUnit === 'bar' ? 100 : 1), t.pUnit === 'bar' ? 2 : 0)} ${t.pUnit}`} />
          <div className="grid2">
            <Slider label={<Term id="superaquecimento">Superaquecimento</Term>} min={0} max={20} step={0.5} unit="K" value={t.superheat} onChange={(superheat) => set({ superheat })} />
            <Slider label={<Term id="subresfriamento">Sub-resfriamento</Term>} min={0} max={15} step={0.5} unit="K" value={t.subcool} onChange={(subcool) => set({ subcool })} />
            <Slider label="Eficiência isentrópica" min={0.5} max={0.9} step={0.01} value={t.etaIs} onChange={(etaIs) => set({ etaIs })} format={(v) => `${Math.round(v * 100)}%`} />
            <Slider label="Capacidade" min={5} max={3000} step={5} unit="kW" value={t.capacity} onChange={(capacity) => set({ capacity })} />
          </div>
        </>
      ) : <p className="small muted">Te = {fmt(ev.temps.Te, 1)} °C, Tc = {fmt(ev.temps.Tc, 1)} °C, capacidade = {fmt(ev.loads.nominal.requiredKW, 0)} kW (do projeto “{useStore.getState().project.name}”).</p>}
      {c.errors.map((e) => <div key={e} className="insight err"><b>Fora do domínio do modelo:</b> {e}</div>)}
      {c.warnings.map((w) => <div key={w} className="insight warn">{w}</div>)}
    </div>
  );
}

function Params() {
  const c = useTechCycle();
  const t = useStore((s) => s.tech);
  if (c.errors.length) return <p className="muted">Nenhum resultado: a combinação de parâmetros está fora do domínio válido.</p>;
  const pf = (p: number) => (t.pUnit === 'bar' ? fmt(p / 100, 3) : fmt(p, 1));
  const tf = (T: number) => (t.tUnit === 'K' ? fmt(T + 273.15, 1) : fmt(T, 1));
  const s1 = c.states[0], sEvap = c.states.find((s) => s.id === (c.states.length > 4 ? '8' : '4'))!;
  const sDis = c.states.find((s) => s.id === (c.states.length > 4 ? '4' : '2'))!;
  const rows: [React.ReactNode, string, string][] = [
    ['Pressão de evaporação', pf(sEvap.P), t.pUnit + ' abs'], ['Pressão de condensação', pf(sDis.P), t.pUnit + ' abs'],
    ['Temperatura de evaporação', tf(sEvap.T), t.tUnit === 'K' ? 'K' : '°C'], ['Temperatura de condensação', tf(tSat(sDis.P)), t.tUnit === 'K' ? 'K' : '°C'],
    ['Temperatura de sucção', tf(s1.T), t.tUnit === 'K' ? 'K' : '°C'], ['Temperatura de descarga', tf(Math.max(c.Tdis, c.Tdis2 ?? -999)), t.tUnit === 'K' ? 'K' : '°C'],
    [<Term id="superaquecimento">Superaquecimento</Term>, fmt(s1.T - sEvap.T, 1), 'K'], [<Term id="relacao-compressao">Relação de compressão</Term>, fmt(c.pressureRatio, 2), '—'],
    ['Vazão mássica (baixa)', fmt(c.mdot * 3600, 0), 'kg/h'], ...(c.mdotHP ? [['Vazão mássica (alta)', fmt(c.mdotHP * 3600, 0), 'kg/h'] as [string, string, string]] : []),
    ['Vazão volumétrica na sucção', fmt(c.Vsuction, 0), 'm³/h'], ['Efeito frigorífico', fmt(c.qe, 1), 'kJ/kg'],
    ['Potência de compressão (eixo)', fmt(c.W, 1), 'kW'], ['Potência elétrica (motor)', fmt(c.Welec, 1), 'kW'], ...(c.Wpump > 0 ? [['Bombas', fmt(c.Wpump, 2), 'kW'] as [string, string, string]] : []),
    ['Capacidade frigorífica', fmt(t.fromProject ? c.Qc - c.W : t.capacity, 1), 'kW'], ['Calor rejeitado', fmt(c.Qc, 1), 'kW'],
    [<Term id="cop">COP</Term>, fmt(c.COP, 2), '—'], ['COP de Carnot', fmt(c.COPcarnot, 2), '—'], ['Eficiência relativa a Carnot', fmt((c.COP / c.COPcarnot) * 100, 0), '%'],
  ];
  return (
    <div>
      <div className="card"><h3>Parâmetros operacionais <span className="spacer" /><OriginChip o="calculado" /></h3>
        <table className="t"><tbody>{rows.map(([k, v, u], i) => <tr key={i}><td>{k}</td><td><b>{v}</b></td><td className="muted">{u}</td></tr>)}</tbody></table>
      </div>
      <div className="card"><h3>Estados termodinâmicos</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="t">
            <thead><tr><th>#</th><th>P [{t.pUnit}]</th><th>T [{t.tUnit === 'K' ? 'K' : '°C'}]</th><th><Term id="entalpia">h</Term></th><th><Term id="entropia">s</Term></th><th>ρ</th><th><Term id="titulo">x</Term></th></tr></thead>
            <tbody>{c.states.map((s) => <tr key={s.id} title={s.label}><td><b>{s.id}</b> <span className="muted">{s.label}</span></td><td>{pf(s.P)}</td><td>{tf(s.T)}</td><td>{fmt(s.h, 1)}</td><td>{fmt(s.s, 3)}</td><td>{fmt(s.rho, s.rho < 10 ? 2 : 0)}</td><td>{s.x === null ? (s.phase === 'vapor' ? 'SA' : 'SR') : fmt(s.x, 3)}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>h em kJ/kg, s em kJ/(kg·K), ρ em kg/m³ (referência IIR). SA = vapor superaquecido; SR = líquido sub-resfriado (aproximação h ≈ hL(T)). Propriedades por interpolação de tabelas CoolProp <OriginChip o="referencia" />.</p>
      </div>
    </div>
  );
}

function Diagrams() {
  const c = useTechCycle();
  const t = useStore((s) => s.tech);
  if (c.errors.length) return <p className="muted">Diagramas indisponíveis: parâmetros fora do domínio.</p>;
  return (
    <div>
      <div className="card"><h3>Diagrama pressão–entalpia (P-h)</h3><PhDiagram cycle={c} pUnit={t.pUnit} /></div>
      <div className="card"><h3>Diagrama temperatura–entropia (T-s)</h3><TsDiagram cycle={c} tUnit={t.tUnit} /></div>
      <p className="small muted">Os diagramas reagem a cada alteração. A cúpula, as isotermas e os estados vêm das mesmas tabelas usadas no cálculo.</p>
    </div>
  );
}

function Performance() {
  const c = useTechCycle();
  const t = useStore((s) => s.tech);
  const curve = useMemo(() => {
    const out: { Te: number; cop: number; w: number }[] = [];
    for (let Te = -50; Te <= 5; Te += 2.5) {
      const r = computeCycle({ Te, Tc: t.Tc, superheat: t.superheat, subcool: t.subcool, etaIs: t.etaIs, etaMotor: t.etaMotor, architecture: t.architecture, capacity: t.capacity });
      if (!r.errors.length) out.push({ Te, cop: r.COP, w: r.Welec + r.Wpump });
    }
    return out;
  }, [t]);
  if (c.errors.length) return null;
  const W = 340, H = 170, m = 30;
  const maxC = Math.max(...curve.map((x) => x.cop), 1);
  const X = (te: number) => m + ((te + 50) / 55) * (W - m - 10);
  const Y = (v: number) => H - 22 - (v / maxC) * (H - 40);
  return (
    <div>
      <div className="card"><h3>Balanço de energia</h3><EnergyBalance qe={c.Qc - c.W} w={c.W} qc={c.Qc} /></div>
      <div className="card"><h3>COP × temperatura de evaporação</h3>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="COP em função da evaporação">
          <path d={curve.map((p, i) => `${i ? 'L' : 'M'}${X(p.Te)},${Y(p.cop)}`).join(' ')} fill="none" stroke="#0069ae" strokeWidth={2.2} />
          {curve.length > 0 && <circle cx={X(t.fromProject ? curve[0].Te : t.Te)} cy={Y(c.COP)} r={4} fill="#e4572e" />}
          <line x1={m} x2={W - 10} y1={H - 22} y2={H - 22} stroke="#5d6b79" /><line x1={m} x2={m} y1={10} y2={H - 22} stroke="#5d6b79" />
          {[-50, -30, -10, 5].map((v) => <text key={v} x={X(v)} y={H - 8} fontSize={9} textAnchor="middle" fill="#5d6b79">{v}°C</text>)}
          {[0, maxC / 2, maxC].map((v) => <text key={v} x={m - 4} y={Y(v) + 3} fontSize={9} textAnchor="end" fill="#5d6b79">{fmt(v, 1)}</text>)}
        </svg>
        <p className="small muted" style={{ margin: 0 }}>Cada 1 K a menos na evaporação reduz o COP; dimensionar evaporadores com TD menor economiza energia. Condensação a {t.Tc} °C.</p>
      </div>
    </div>
  );
}

function Architectures() {
  const t = useStore((s) => s.tech);
  const set = useStore((s) => s.setTech);
  const up = useStore((s) => s.update);
  const rows = useMemo(() => ARCHITECTURES.map((a) => ({ a, c: computeCycle({ Te: t.Te - (a.id === 'indireto' ? 6 : 0), Tc: t.Tc, superheat: t.superheat, subcool: t.subcool, etaIs: t.etaIs, etaMotor: t.etaMotor, architecture: a.id, capacity: t.capacity }) })), [t]);
  return (
    <div>
      <p className="small muted" style={{ marginTop: 0 }}>Mesma capacidade ({t.capacity} kW) e temperaturas de referência ({t.Te}/{t.Tc} °C). Cada arquitetura tem seu próprio ciclo e seu próprio circuito 3D. No sistema indireto, a evaporação é 6 K mais baixa por causa do fluido secundário (hipótese).</p>
      {rows.map(({ a, c }) => (
        <div key={a.id} className="card">
          <h3>{a.name}<span className="spacer" /><button className={`btn sm ${t.architecture === a.id ? 'primary' : ''}`} onClick={() => { set({ architecture: a.id }); up((q) => { q.system.architecture = a.id; }); }}>{t.architecture === a.id ? 'No 3D' : 'Ver no 3D'}</button></h3>
          <p className="small" style={{ marginTop: 0 }}>{a.desc}</p>
          {c.errors.length ? <div className="insight err">{c.errors[0]}</div> : (
            <div className="grid3 small">
              <div><span className="muted">COP</span><br /><b>{fmt(c.COP, 2)}</b></div>
              <div><span className="muted">kW elétricos</span><br /><b>{fmt(c.Welec + c.Wpump, 1)}</b></div>
              <div><span className="muted">Descarga</span><br /><b>{fmt(Math.max(c.Tdis, c.Tdis2 ?? -999), 0)} °C</b></div>
            </div>
          )}
          {c.warnings.map((w) => <div key={w} className="small" style={{ color: 'var(--warn)', marginTop: 4 }}>{w}</div>)}
        </div>
      ))}
    </div>
  );
}

function Lib() {
  const s = useStore();
  return (
    <div>
      <div className="card"><h3>Biblioteca de equipamentos</h3><p className="small">Famílias do catálogo Engefril e componentes de terceiros, com dados técnicos por origem, princípio de funcionamento e localização na cena.</p><button className="btn" onClick={() => s.setModal('biblioteca')}><I.equip /> Abrir biblioteca</button></div>
      <div className="card"><h3>Fluidos e tecnologias alternativas</h3><p className="small">Comparação qualitativa entre NH₃, CO₂ em cascata, sistemas indiretos, HFC/HFO e hidrocarbonetos, por aplicação, eficiência, segurança, impacto ambiental e complexidade.</p><button className="btn" onClick={() => s.setModal('biblioteca')}>Ver comparação</button></div>
      <div className="card"><h3>Segurança industrial</h3><p className="small">Propriedades do NH₃, toxicidade, detecção, ventilação, vasos de pressão e procedimentos em nível informativo.</p><button className="btn" onClick={() => s.setModal('seguranca')}><I.shield /> Módulo de segurança</button></div>
    </div>
  );
}
