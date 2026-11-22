import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { evalCached } from '../../state/useEvaluation';
import { compare } from '../../engine/analysis';
import { PairBars } from '../../ui/Charts';
import { Num, brl, fmt } from '../../ui/common';
import { I } from '../../ui/Icons';
import type { Project } from '../../engine/types';

const OPTIMIZE: { label: string; fn: (p: Project) => void }[] = [
  { label: 'Isolamento +50 mm', fn: (p) => { p.envelope.wallThk = Math.min(250, p.envelope.wallThk + 50); p.envelope.roofThk = Math.min(250, p.envelope.roofThk + 50); } },
  { label: 'Cortinas de PVC em todas as portas', fn: (p) => p.doors.forEach((d) => (d.protection = 'pvc')) },
  { label: 'Menos aberturas de porta (−30%)', fn: (p) => p.doors.forEach((d) => (d.passagesPerHour = Math.round(d.passagesPerHour * 0.7 * 10) / 10)) },
  { label: 'Iluminação LED eficiente (5 W/m²)', fn: (p) => { p.internal.lightingWm2 = Math.min(p.internal.lightingWm2, 5); } },
  { label: 'Ventiladores mais eficientes (η 60%)', fn: (p) => { p.system.fanEta = 0.6; } },
  { label: 'Temperatura interna +1 K', fn: (p) => { p.room.Tin += 1; } },
  { label: 'Condensador maior (aproximação −3 K)', fn: (p) => { p.system.condApproach = Math.max(5, p.system.condApproach - 3); } },
  { label: 'Recirculação bombeada', fn: (p) => { p.system.architecture = 'bombeado'; } },
  { label: 'Duplo estágio', fn: (p) => { p.system.architecture = 'duplo-estagio'; } },
];

export default function CompareFinance() {
  const s = useStore();
  const A = s.project, B = s.scenarioB;
  const ea = evalCached(A);
  const eb = B ? evalCached(B) : null;
  const cmp = useMemo(() => (B && eb ? compare(A, ea, B, eb) : null), [A, B, ea, eb]);
  const startB = () => { const b = structuredClone(A); b.name = `${A.name} · cenário B`; s.setScenarioB(b); s.setEditing('B'); s.setView({ split: true }); };
  return (
    <div>
      {!B ? (
        <div className="card">
          <h3>Comparador de cenários</h3>
          <p className="small">O cenário A é a configuração atual. Crie um cenário B (cópia) e altere o que quiser: isolamento, portas, temperatura, arquitetura.</p>
          <button className="btn primary" onClick={startB}><I.compare /> Criar cenário B</button>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>Melhorias rápidas no cenário B</h3>
            <div className="btns">{OPTIMIZE.map((o) => <button key={o.label} className="btn sm" onClick={() => s.updateB(o.fn)}>{o.label}</button>)}</div>
            <div className="btns" style={{ marginTop: 8 }}>
              <button className={`btn sm ${s.editing === 'A' ? 'primary' : ''}`} onClick={() => s.setEditing('A')}>Editar A nas etapas</button>
              <button className={`btn sm ${s.editing === 'B' ? 'primary' : ''}`} onClick={() => s.setEditing('B')}>Editar B nas etapas</button>
              <button className={`btn sm ${s.view.split ? 'primary' : ''}`} onClick={() => s.setView({ split: !s.view.split })}><I.compare /> {s.view.split ? 'Vista única' : 'Ver A e B lado a lado'}</button>
              <button className="btn sm" onClick={() => { s.setProject(B); s.setScenarioB(null); }}>Adotar B como projeto</button>
              <button className="btn sm" onClick={() => s.setScenarioB(null)}><I.trash /> Descartar B</button>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>{s.view.split ? 'Vista dividida: A à esquerda e B à direita (no celular, A em cima). O cenário em edição fica destacado em azul.' : `A cena 3D mostra o cenário em edição (${s.editing}).`}</p>
          </div>
          {eb && cmp && (
            <div className="card">
              <h3>A × B</h3>
              <PairBars rows={[
                { label: 'Capacidade requerida', a: ea.loads.nominal.requiredKW, b: eb.loads.nominal.requiredKW, unit: 'kW', d: 0 },
                { label: 'Carga térmica diária', a: ea.loads.nominal.totalKWhDay, b: eb.loads.nominal.totalKWhDay, unit: 'kWh/dia', d: 0 },
                { label: 'Potência elétrica', a: ea.energy.totalElecKW, b: eb.energy.totalElecKW, unit: 'kW', d: 0 },
                { label: 'Consumo anual', a: ea.energy.kWhYear / 1000, b: eb.energy.kWhYear / 1000, unit: 'MWh/ano', d: 0 },
                { label: 'Custo de energia', a: ea.energy.costYear / 1000, b: eb.energy.costYear / 1000, unit: 'mil R$/ano', d: 0 },
              ]} />
              <div className="kpis">
                <div className="kpi"><span>Diferença de consumo</span><b>{fmt(cmp.dKWh / 1000, 0)} MWh/ano</b><i>{cmp.dKWh >= 0 ? 'B consome menos' : 'B consome mais'}</i></div>
                <div className="kpi"><span>Economia potencial</span><b>{brl(cmp.dCost)}</b><i>por ano, com a tarifa informada</i></div>
              </div>
            </div>
          )}
        </>
      )}
      <div className="card">
        <h3>Estimativa financeira</h3>
        <p className="small" style={{ marginTop: 0 }}><b>Valor de fornecimento sujeito a orçamento técnico-comercial.</b> Não há preços públicos verificáveis de equipamentos Engefril. Informe valores apenas com origem identificada.</p>
        <div className="grid2">
          <Num label={<>Investimento <span className="ab a">A</span></>} unit="R$" value={A.finance.investment ?? 0} min={0} max={1e10} onChange={(v) => s.setProject({ ...A, finance: { ...A.finance, investment: v || null } })} />
          {B && <Num label={<>Investimento <span className="ab b">B</span></>} unit="R$" value={B.finance.investment ?? 0} min={0} max={1e10} onChange={(v) => s.updateB((q) => { q.finance.investment = v || null; })} />}
        </div>
        <label className="field"><span>Origem dos valores (obrigatória para o relatório)</span><input placeholder="Ex.: orçamento nº…, estimativa interna, proposta de…" value={A.finance.investmentSource} onChange={(e) => s.update((q) => { q.finance.investmentSource = e.target.value; }, 'src')} /></label>
        <Num label="Custo anual de manutenção (opcional)" unit="R$/ano" value={A.finance.maintenance ?? 0} min={0} max={1e9} onChange={(v) => s.update((q) => { q.finance.maintenance = v || null; }, 'mnt')} />
        <div className="kpis">
          <div className="kpi"><span>Custo de energia (A)</span><b>{brl(ea.energy.costYear)}</b><i>por ano · {fmt(A.finance.tariff, 2)} R$/kWh</i></div>
          <div className="kpi"><span>Custo operacional (A)</span><b>{brl(ea.energy.costYear + (A.finance.maintenance ?? 0))}</b><i>energia{A.finance.maintenance ? ' + manutenção' : ''}</i></div>
          {cmp && <div className="kpi big"><span>Payback simples do investimento adicional em B</span><b>{cmp.payback ? `${fmt(cmp.payback, 1)} anos` : 'Não calculado'}</b><i>{cmp.note}</i></div>}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Não prometemos percentuais de economia: os valores resultam do modelo e das premissas exibidas, na condição de projeto.</p>
      </div>
    </div>
  );
}
