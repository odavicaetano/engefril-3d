import { useMemo } from 'react';
import { useActiveProject } from '../../state/store';
import { useEvaluation } from '../../state/useEvaluation';
import { QUALITY_INFO, sensitivity } from '../../engine/analysis';
import { LOAD_LABEL } from '../../engine/loads';
import { BreakdownBars, Tornado } from '../../ui/Charts';
import { OriginChip, fmt, sig } from '../../ui/common';

export default function Results() {
  const p = useActiveProject();
  const ev = useEvaluation();
  const sens = useMemo(() => sensitivity(p), [p]);
  const n = ev.loads.nominal;
  const invalid = ev.cycle.errors.length > 0;
  return (
    <div>
      <div className="kpis">
        <div className="kpi big"><span>Capacidade frigorífica preliminar requerida</span><b>{invalid ? '—' : `${fmt(sig(ev.range[0]), 0)} – ${fmt(sig(ev.range[1]), 0)} kW`}</b><i>Nominal de {fmt(sig(n.requiredKW, 3), 0)} kW ≈ {fmt(n.requiredKW / 3.517, 0)} TR, com fator de segurança de {Math.round(p.system.safetyFactor * 100)}% <OriginChip o="calculado" /></i></div>
        {p.application !== 'agua-gelada' ? <>
          <div className="kpi"><span>Área total</span><b>{fmt(n.geometry.floor * p.room.count, 0)} m²</b><i>{p.room.count} câmara(s)</i></div>
          <div className="kpi"><span>Volume refrigerado</span><b>{fmt(n.geometry.volume * p.room.count, 0)} m³</b><i>{fmt((n.requiredKW * 1000) / (n.geometry.volume * p.room.count), 0)} W/m³</i></div>
        </> : <div className="kpi"><span>Pico do processo</span><b>{fmt(n.processKW ?? 0, 0)} kW</b></div>}
        <div className="kpi"><span>Temperatura desejada</span><b>{p.application === 'agua-gelada' ? p.process.Tout : p.room.Tin} °C</b><i>evaporação {fmt(ev.temps.Te, 0)} °C · condensação {fmt(ev.temps.Tc, 0)} °C</i></div>
        <div className="kpi"><span>Carga térmica média</span><b>{fmt(n.avgKW, 1)} kW</b><i>{fmt(n.totalKWhDay, 0)} kWh térmicos/dia</i></div>
        <div className="kpi"><span>Potência elétrica estimada</span><b>{invalid ? '—' : `${fmt(ev.energy.totalElecKW, 0)} kW`}</b><i>COP do ciclo {invalid ? '—' : fmt(ev.cycle.COP, 2)}</i></div>
        <div className="kpi"><span>Consumo de energia estimado</span><b>{invalid ? '—' : `${fmt(sig(ev.energy.kWhYear / 1000, 2), 0)} MWh/ano`}</b><i>{fmt(ev.energy.kWhDay, 0)} kWh/dia · {invalid ? '' : ev.energy.costYear.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/ano</i></div>
      </div>
      {invalid && ev.cycle.errors.map((e) => <div key={e} className="insight err">{e}</div>)}
      <div className="row" style={{ marginBottom: 8, gap: 6 }}><span className={`chip q-${ev.quality}`}>Nível: {QUALITY_INFO[ev.quality].label}</span><span className="small muted">{QUALITY_INFO[ev.quality].desc}</span></div>
      <div className="card">
        <h3>Resumo</h3>
        {ev.insights.length ? ev.insights.map((t) => <div key={t} className={`insight ${t.includes('Relação') || t.includes('descarga') || t.includes('pouco usual') ? 'warn' : ''}`}>{t}</div>) : <p className="small muted" style={{ margin: 0 }}>Nenhuma fonte de carga domina este cenário. A carga está distribuída entre várias parcelas.</p>}
      </div>
      <div className="card">
        <h3>Principais fontes de ganho de calor</h3>
        <BreakdownBars items={ev.breakdown} />
        <details className="small"><summary>Detalhes e premissas de cada parcela</summary>
          <ul className="clean">{n.items.map((i) => <li key={i.key}><b>{LOAD_LABEL[i.key]}:</b> {fmt(i.kWhDay, 0)} kWh/dia. {i.note}</li>)}</ul>
          <p>Capacidade pela média diária: {fmt(n.capacityAvgBasis, 1)} kW ({p.system.runHours} h/dia de operação). Pelo pico simultâneo (cargas contínuas + produto concentrado no tempo de processo): {fmt(n.capacityPeakBasis, 1)} kW. Adota-se o maior valor, sem dupla contagem.</p>
        </details>
      </div>
      <div className="card">
        <h3>Sensibilidade da capacidade</h3>
        <Tornado items={sens} />
        <p className="small muted" style={{ margin: 0 }}>Variação da capacidade nominal quando cada parâmetro muda isoladamente. Azul: redução do parâmetro; vermelho: aumento. Os mais influentes são os dados a confirmar primeiro.</p>
      </div>
      <div className="card">
        <h3>Faixa de incerteza</h3>
        <p className="small" style={{ margin: 0 }}>Baixa: {fmt(ev.loads.baixo.requiredKW, 0)} kW · Nominal: {fmt(n.requiredKW, 0)} kW · Alta: {fmt(ev.loads.alto.requiredKW, 0)} kW, combinando as faixas da literatura (λ, Df, efetividade das proteções, Δp dos ventiladores, eficiência do degelo, cp). Some-se uma margem de ±{Math.round(QUALITY_INFO[ev.quality].extra * 100)}% pela qualidade dos dados. {ev.energy.seasonalNote}</p>
      </div>
      <div className="card">
        <h3>Dados ainda necessários para o projeto definitivo</h3>
        <ul className="clean small">{ev.missing.map((m) => <li key={m}>{m}</li>)}</ul>
      </div>
    </div>
  );
}
