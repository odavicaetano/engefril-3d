import { useMemo } from 'react';
import { useActiveProject, useStore } from '../../state/store';
import { useEvaluation } from '../../state/useEvaluation';
import { suggestEquipment } from '../../engine/suggest';
import { ARCHITECTURES, computeCycle, type Architecture } from '../../engine/cycle';
import { OriginChip, fmt } from '../../ui/common';
import { I } from '../../ui/Icons';

export default function Equipment() {
  const p = useActiveProject();
  const ev = useEvaluation();
  const s = useStore();
  const list = useMemo(() => suggestEquipment(p, ev), [p, ev]);
  // Alternativas compatíveis: mesma carga, outras arquiteturas (verificação de compatibilidade pelo próprio motor)
  const alts = useMemo(() => ARCHITECTURES.map((a) => {
    let Te = ev.temps.Te;
    if (a.id === 'indireto' && p.system.architecture !== 'indireto') Te -= 6;
    if (a.id !== 'indireto' && p.system.architecture === 'indireto') Te += 6;
    const c = computeCycle({ Te, Tc: ev.temps.Tc, superheat: p.system.superheat, subcool: p.system.subcool, etaIs: p.system.etaIs, etaMotor: p.system.etaMotor, architecture: a.id, capacity: ev.loads.nominal.requiredKW });
    return { a, c, Te };
  }), [p, ev]);
  const setArch = (id: Architecture) => s.update((q) => { q.system.architecture = id; });
  return (
    <div>
      <p className="small muted" style={{ marginTop: 0 }}>Famílias de solução compatíveis com o cenário. As capacidades de modelos específicos não são publicadas pela Engefril; a seleção final exige orçamento técnico-comercial.</p>
      {list.map((x) => (
        <div key={x.category} className="card">
          <h3>{x.category}<span className="spacer" /><OriginChip o={x.origin} /></h3>
          {x.product && <div className="small"><b>Referência:</b> {x.product} {x.url && <a href={x.url} target="_blank" rel="noopener noreferrer">(fonte)</a>}</div>}
          <p className="small" style={{ margin: '6px 0' }}>{x.why}</p>
          <div className="small muted">Para selecionar um modelo, falta: {x.missing.join('; ')}.</div>
          {x.equipId && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => { s.setView({ selected: x.equipId! }); s.goCamera(x.equipId === 'camara' ? 'camara-externa' : x.equipId!); }}><I.eye /> Ver no modelo 3D</button>}
        </div>
      ))}
      {p.application !== 'agua-gelada' && (
        <div className="card">
          <h3>Substituir a arquitetura do sistema</h3>
          <table className="t">
            <thead><tr><th>Arquitetura</th><th>Te</th><th>COP</th><th>kW elét.</th><th>Descarga</th><th></th></tr></thead>
            <tbody>{alts.map(({ a, c, Te }) => (
              <tr key={a.id} style={a.id === p.system.architecture ? { background: 'var(--brand-50)' } : undefined}>
                <td>{a.name}</td><td>{fmt(Te, 0)} °C</td><td>{c.errors.length ? '—' : fmt(c.COP, 2)}</td><td>{c.errors.length ? '—' : fmt(c.Welec + c.Wpump, 0)}</td>
                <td>{c.errors.length ? '—' : `${fmt(Math.max(c.Tdis, c.Tdis2 ?? -1), 0)} °C`}</td>
                <td>{a.id !== p.system.architecture && <button className="btn sm" disabled={!!c.errors.length} onClick={() => setArch(a.id)}>Usar</button>}</td>
              </tr>
            ))}</tbody>
          </table>
          {alts.filter((x) => x.c.warnings.length).map((x) => <div key={x.a.id} className="small muted" style={{ marginTop: 4 }}><b>{x.a.name}:</b> {x.c.warnings.join(' ')}</div>)}
          <p className="small muted" style={{ marginBottom: 0 }}>A troca atualiza o circuito 3D (separador, bombas, intercooler ou trocador) e todos os cálculos. A compatibilidade é verificada pelo domínio de validade do motor de ciclo.</p>
        </div>
      )}
    </div>
  );
}
