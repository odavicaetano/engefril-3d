import { useStore } from '../state/store';
import { evalCached } from '../state/useEvaluation';
import type { Project } from '../engine/types';
import { fmt, sig } from './common';

/** Identificação e indicadores-chave de cada metade da vista dividida. */
export default function PaneBadge({ side, p, other }: { side: 'A' | 'B'; p: Project; other: Project }) {
  const editing = useStore((s) => s.editing);
  const setEditing = useStore((s) => s.setEditing);
  const e = evalCached(p), o = evalCached(other);
  const d = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
  const delta = (a: number, b: number) => {
    const v = d(a, b);
    if (side === 'A' || Math.abs(v) < 0.5) return null;
    return <em className={v < 0 ? 'good' : 'bad'}>{v > 0 ? '+' : ''}{fmt(v, 0)}%</em>;
  };
  const invalid = e.cycle.errors.length > 0;
  return (
    <div className={`pane-badge ${editing === side ? 'on' : ''}`}>
      <div className="row" style={{ gap: 6 }}>
        <span className={`ab ${side.toLowerCase()}`}>{side}</span>
        <b className="pane-name" title={p.name}>{p.name}</b>
        <button className="btn sm" disabled={editing === side} onClick={() => setEditing(side)}>{editing === side ? 'Em edição' : 'Editar'}</button>
      </div>
      <div className="pane-kpis">
        <span>Capacidade <b>{invalid ? '—' : `${fmt(sig(e.loads.nominal.requiredKW, 3), 0)} kW`}</b>{delta(e.loads.nominal.requiredKW, o.loads.nominal.requiredKW)}</span>
        <span>Elétrica <b>{invalid ? '—' : `${fmt(e.energy.totalElecKW, 0)} kW`}</b>{delta(e.energy.totalElecKW, o.energy.totalElecKW)}</span>
        <span>Energia <b>{invalid ? '—' : `${fmt(e.energy.kWhYear / 1000, 0)} MWh/ano`}</b>{delta(e.energy.kWhYear, o.energy.kWhYear)}</span>
        <span>COP <b>{invalid ? '—' : fmt(e.cycle.COP, 2)}</b></span>
      </div>
    </div>
  );
}
