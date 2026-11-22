import { useStore } from '../state/store';
import { useEvaluation } from '../state/useEvaluation';
import { infoFor } from '../data/equipment';
import { useLayout } from '../scene/sceneUtils';
import { I } from './Icons';
import { OriginChip, fmt } from './common';

export default function EquipmentPanel() {
  const s = useStore();
  const sel = s.view.selected;
  const l = useLayout();
  const ev = useEvaluation();
  const info = infoFor(sel);
  const touring = useStore((x) => x.tour.active || !!x.howItWorks);
  if (!sel || !info || touring) return null;
  const e = l.equips.find((x) => x.id === sel);
  const c = ev.cycle;
  const live: [string, string][] = [];
  const ok = !c.errors.length;
  if (info.kind === 'compressor' && ok) {
    const two = l.arch === 'duplo-estagio';
    live.push(['Potência elétrica total dos compressores', `${fmt(c.Welec, 1)} kW`], ['Temperatura de descarga', `${fmt(two ? (sel.endsWith('1') ? c.Tdis : c.Tdis2 ?? c.Tdis) : c.Tdis, 0)} °C`], ['Relação de compressão', fmt(c.pressureRatio, 1)], ['Vazão volumétrica na sucção', `${fmt(c.Vsuction, 0)} m³/h`]);
  }
  if (info.kind === 'evaporador' && ok) live.push(['Capacidade por evaporador (estimada)', `${fmt(ev.loads.nominal.requiredKW / Math.max(1, l.evaps.length) / Math.max(1, s.project.room.count), 1)} kW`], ['Temperatura de evaporação', `${fmt(ev.temps.Te, 1)} °C`], ['Temperatura do ar da câmara', `${fmt(s.project.room.Tin, 1)} °C`]);
  if (info.kind === 'condensador' && ok) live.push(['Calor rejeitado', `${fmt(c.Qc, 0)} kW`], ['Bulbo úmido de projeto', `${fmt(ev.temps.twb, 1)} °C`], ['Temperatura de condensação', `${fmt(ev.temps.Tc, 1)} °C`]);
  if ((info.kind === 'separador' || info.kind === 'recipiente') && ok) live.push(['Vazão mássica de NH₃', `${fmt(c.mdot * 3600, 0)} kg/h`], ['Pressão', `${fmt((c.states.find((x) => x.id === (info.kind === 'separador' ? '1' : '3'))?.P ?? 0) / 100, 2)} bar abs`]);
  if (info.kind === 'camara') live.push(['Transmitância das paredes (U)', `${fmt(ev.loads.nominal.U.wall, 3)} W/m²·K`], ['Volume', `${fmt(ev.loads.nominal.geometry.volume, 0)} m³`]);
  if (info.kind === 'bomba' && ok) live.push(['Potência estimada das bombas', `${fmt(c.Wpump, 2)} kW`]);
  return (
    <aside className="ctx" aria-label="Painel do equipamento">
      <div className="side-head">
        <h2>{e?.label ?? info.name}</h2>
        <button className="ib" aria-label="Fechar" onClick={() => s.setView({ selected: null, isolate: false })}><I.close /></button>
      </div>
      <div className="side-body">
        <div className="btns" style={{ marginBottom: 10 }}>
          <button className="btn sm primary" onClick={() => s.setHowItWorks(sel)}><I.play /> Como funciona?</button>
          <button className={`btn sm ${s.view.isolate ? 'primary' : ''}`} onClick={() => s.setView({ isolate: !s.view.isolate })}><I.isolate /> {s.view.isolate ? 'Ver na instalação' : 'Isolar'}</button>
          <button className="btn sm" onClick={() => s.goCamera(sel === 'camara' ? 'camara-externa' : sel)}><I.camera /> Focar</button>
          <button className="btn sm" onClick={() => s.setView({ cut: s.view.cut === 'nenhum' ? 'longitudinal' : 'nenhum' })}><I.cut /> {s.view.cut === 'nenhum' ? 'Cortar' : 'Sem corte'}</button>
        </div>
        <p style={{ marginTop: 0 }}><b>Função.</b> {info.fn}</p>
        <p><b>Princípio de funcionamento.</b> {info.principle}</p>
        {live.length > 0 && (
          <div className="card dark">
            <h3>No cenário atual <span className="chip o-calculado" style={{ marginLeft: 'auto' }}>Estimativa calculada</span></h3>
            <table className="t" style={{ color: '#e7eef6' }}><tbody>{live.map(([k, v]) => <tr key={k}><td style={{ borderColor: '#24425f' }}>{k}</td><td style={{ borderColor: '#24425f' }}><b>{v}</b></td></tr>)}</tbody></table>
          </div>
        )}
        <h4 style={{ margin: '10px 0 6px' }}>Dados técnicos</h4>
        <ul className="clean small">{info.facts.map((f, i) => <li key={i}>{f.text} <OriginChip o={f.origin} /></li>)}</ul>
        <h4 style={{ margin: '10px 0 6px' }}>Aplicações</h4>
        <ul className="clean small">{info.applications.map((a) => <li key={a}>{a}</li>)}</ul>
        <h4 style={{ margin: '10px 0 6px' }}>Variáveis importantes</h4>
        <ul className="clean small">{info.variables.map((a) => <li key={a}>{a}</li>)}</ul>
        {info.pros.length > 0 && <><h4 style={{ margin: '10px 0 6px' }}>Vantagens</h4><ul className="clean small">{info.pros.map((a) => <li key={a}>{a}</li>)}</ul></>}
        {info.cons.length > 0 && <><h4 style={{ margin: '10px 0 6px' }}>Limitações</h4><ul className="clean small">{info.cons.map((a) => <li key={a}>{a}</li>)}</ul></>}
        <p className="small muted">Referência visual: o modelo 3D é uma representação esquemática. As fotografias oficiais estão no site do fabricante e não foram reproduzidas, por respeito aos direitos de imagem.</p>
        {info.url && <a className="btn sm" href={info.url} target="_blank" rel="noopener noreferrer"><I.link /> Fonte original (engefril.com.br)</a>}
      </div>
    </aside>
  );
}
