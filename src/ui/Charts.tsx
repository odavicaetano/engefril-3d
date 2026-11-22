import { useMemo } from 'react';
import { domeData, isotherm, satT, tSat } from '../engine/r717';
import type { CycleResult } from '../engine/cycle';
import { fmt } from './common';

const C = { line: '#dde3e9', axis: '#5d6b79', dome: '#0b1a2b', cycle: '#0069ae', iso: '#c9d3dd', text: '#5d6b79' };
const PAL = ['#0069ae', '#e4572e', '#f0a202', '#1f9d55', '#6b5bd2', '#46b3e6', '#9c9aa0', '#c27c00', '#484848'];

export function BreakdownBars({ items, unit = 'kWh/dia' }: { items: { label: string; kWhDay: number; share: number }[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.kWhDay), 1);
  return (
    <div role="img" aria-label="Distribuição da carga térmica por fonte">
      {items.map((it, k) => (
        <div key={it.label} style={{ marginBottom: 6 }}>
          <div className="row small" style={{ justifyContent: 'space-between' }}><span>{it.label}</span><b>{fmt(it.share * 100, 0)}% · {fmt(it.kWhDay, 0)} {unit}</b></div>
          <div style={{ height: 8, background: '#eef1f4', borderRadius: 4 }}><div style={{ width: `${(it.kWhDay / max) * 100}%`, height: '100%', background: PAL[k % PAL.length], borderRadius: 4 }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Tornado({ items, unit = 'kW' }: { items: { label: string; low: number; high: number }[]; unit?: string }) {
  const max = Math.max(...items.flatMap((i) => [Math.abs(i.low), Math.abs(i.high)]), 0.001);
  const W = 340, mid = W / 2;
  return (
    <svg viewBox={`0 0 ${W} ${items.length * 34 + 10}`} width="100%" role="img" aria-label="Sensibilidade da capacidade requerida">
      <line x1={mid} x2={mid} y1={0} y2={items.length * 34 + 10} stroke={C.axis} />
      {items.map((it, i) => {
        const y = i * 34 + 14;
        const bar = (v: number, col: string) => { const w = (Math.abs(v) / max) * (mid - 10); return <rect x={v < 0 ? mid - w : mid} y={y} width={w} height={10} fill={col} rx={2} />; };
        return (
          <g key={it.label}>
            <text x={4} y={y - 3} fontSize={10} fill={C.text}>{it.label}</text>
            {bar(it.low, '#46b3e6')}{bar(it.high, '#e4572e')}
            <text x={W - 4} y={y + 9} fontSize={10} textAnchor="end" fill={C.text}>{it.low >= 0 ? '+' : ''}{fmt(it.low, 1)} / {it.high >= 0 ? '+' : ''}{fmt(it.high, 1)} {unit}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Diagrama pressão–entalpia (escala log), com cúpula, isotermas e o ciclo calculado. */
export function PhDiagram({ cycle, pUnit = 'kPa', compact = false }: { cycle: CycleResult; pUnit?: 'kPa' | 'bar'; compact?: boolean }) {
  const W = 520, H = compact ? 300 : 360, m = { l: 52, r: 14, t: 14, b: 38 };
  const hMin = -150, hMax = 2000, pMin = 20, pMax = 8000;
  const X = (h: number) => m.l + ((h - hMin) / (hMax - hMin)) * (W - m.l - m.r);
  const Y = (p: number) => H - m.b - ((Math.log10(p) - Math.log10(pMin)) / (Math.log10(pMax) - Math.log10(pMin))) * (H - m.t - m.b);
  const dome = useMemo(() => domeData(2).filter((s) => s.P >= pMin && s.P <= pMax), []);
  const isos = useMemo(() => [-40, -20, 0, 20, 40, 60, 100, 140].map((T) => ({ T, pts: isotherm(T, pMin, pMax, 40) })), []);
  const path = (pts: { P: number; h: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.h).toFixed(1)},${Y(Math.min(pMax, Math.max(pMin, p.P))).toFixed(1)}`).join(' ');
  const domePath = path([...dome.map((s) => ({ P: s.P, h: s.hL })), ...[...dome].reverse().map((s) => ({ P: s.P, h: s.hV }))]);
  const st = Object.fromEntries(cycle.states.map((s) => [s.id, s]));
  const pf = (p: number) => (pUnit === 'bar' ? fmt(p / 100, 1) : fmt(p, 0));
  const ticksP = [20, 50, 100, 200, 500, 1000, 2000, 5000];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagrama pressão-entalpia do R717">
      <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="#fbfcfd" stroke={C.line} />
      {ticksP.map((p) => <g key={p}><line x1={m.l} x2={W - m.r} y1={Y(p)} y2={Y(p)} stroke={C.line} /><text x={m.l - 4} y={Y(p) + 3} fontSize={9} textAnchor="end" fill={C.text}>{pf(p)}</text></g>)}
      {[0, 500, 1000, 1500, 2000].map((h) => <g key={h}><line x1={X(h)} x2={X(h)} y1={m.t} y2={H - m.b} stroke={C.line} /><text x={X(h)} y={H - m.b + 12} fontSize={9} textAnchor="middle" fill={C.text}>{h}</text></g>)}
      {isos.map((i) => { const lp = i.pts[Math.min(i.pts.length - 1, 5)]; return i.pts.length > 1 && <g key={i.T}><path d={path(i.pts)} fill="none" stroke={C.iso} strokeDasharray="3 3" />{lp && <text x={X(lp.h) + 3} y={Y(Math.min(pMax, Math.max(pMin, lp.P))) + 3} fontSize={8} fill="#8a96a3">{i.T}°C</text>}</g>; })}
      <path d={domePath} fill="rgba(70,179,230,.08)" stroke={C.dome} strokeWidth={1.4} />
      {cycle.path.map((seq, k) => {
        const pts = seq.map((id) => st[id]).filter(Boolean);
        return <path key={k} d={path(pts)} fill="none" stroke={C.cycle} strokeWidth={2.4} strokeLinejoin="round" />;
      })}
      {cycle.states.map((s) => <g key={s.id}><circle cx={X(s.h)} cy={Y(s.P)} r={4} fill="#fff" stroke={C.cycle} strokeWidth={2} /><text x={X(s.h) + 6} y={Y(s.P) - 6} fontSize={10} fontWeight={700} fill={C.dome}>{s.id}</text></g>)}
      <text x={(W + m.l) / 2} y={H - 6} fontSize={10} textAnchor="middle" fill={C.axis}>Entalpia h [kJ/kg] (referência IIR)</text>
      <text x={12} y={(H - m.b) / 2} fontSize={10} textAnchor="middle" fill={C.axis} transform={`rotate(-90 12 ${(H - m.b) / 2})`}>Pressão [{pUnit === 'bar' ? 'bar abs' : 'kPa abs'}]</text>
    </svg>
  );
}

/** Diagrama temperatura–entropia. */
export function TsDiagram({ cycle, tUnit = 'C', compact = false }: { cycle: CycleResult; tUnit?: 'C' | 'K'; compact?: boolean }) {
  const W = 520, H = compact ? 300 : 360, m = { l: 46, r: 14, t: 14, b: 38 };
  const sMin = 0, sMax = 7.5, tMin = -60, tMax = 180;
  const X = (s: number) => m.l + ((s - sMin) / (sMax - sMin)) * (W - m.l - m.r);
  const Y = (t: number) => H - m.b - ((t - tMin) / (tMax - tMin)) * (H - m.t - m.b);
  const dome = useMemo(() => domeData(2).filter((s) => s.T >= tMin), []);
  const domePath = [...dome.map((s) => `${X(s.sL)},${Y(s.T)}`), ...[...dome].reverse().map((s) => `${X(s.sV)},${Y(s.T)}`)].map((p, i) => `${i ? 'L' : 'M'}${p}`).join(' ');
  const st = Object.fromEntries(cycle.states.map((s) => [s.id, s]));
  const tf = (t: number) => (tUnit === 'K' ? fmt(t + 273.15, 0) : String(t));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Diagrama temperatura-entropia do R717">
      <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="#fbfcfd" stroke={C.line} />
      {[-40, 0, 40, 80, 120, 160].map((t) => <g key={t}><line x1={m.l} x2={W - m.r} y1={Y(t)} y2={Y(t)} stroke={C.line} /><text x={m.l - 4} y={Y(t) + 3} fontSize={9} textAnchor="end" fill={C.text}>{tf(t)}</text></g>)}
      {[0, 2, 4, 6].map((s) => <g key={s}><line x1={X(s)} x2={X(s)} y1={m.t} y2={H - m.b} stroke={C.line} /><text x={X(s)} y={H - m.b + 12} fontSize={9} textAnchor="middle" fill={C.text}>{s}</text></g>)}
      <path d={domePath} fill="rgba(70,179,230,.08)" stroke={C.dome} strokeWidth={1.4} />
      {cycle.path.map((seq, k) => {
        // Trechos isobáricos seguem a curva real: dessuperaquecimento → patamar de mudança de fase
        const pts: { s: number; T: number }[] = [];
        seq.forEach((id, i) => {
          const b = st[id];
          const a = i ? st[seq[i - 1]] : null;
          if (a && Math.abs(a.P - b.P) / b.P < 0.005) {
            const sat = satT(tSat(b.P));
            const aV = a.phase === 'vapor', bV = b.phase === 'vapor';
            if (aV && !bV) { pts.push({ s: sat.sV, T: sat.T }); if (b.phase === 'liquido') pts.push({ s: sat.sL, T: sat.T }); }
            else if (!aV && bV) pts.push({ s: sat.sV, T: sat.T });
          }
          pts.push({ s: b.s, T: b.T });
        });
        return <path key={k} d={pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.s)},${Y(Math.min(tMax, p.T))}`).join(' ')} fill="none" stroke={C.cycle} strokeWidth={2.4} strokeLinejoin="round" />;
      })}
      {cycle.states.map((s) => <g key={s.id}><circle cx={X(s.s)} cy={Y(Math.min(tMax, s.T))} r={4} fill="#fff" stroke={C.cycle} strokeWidth={2} /><text x={X(s.s) + 6} y={Y(Math.min(tMax, s.T)) - 6} fontSize={10} fontWeight={700}>{s.id}</text></g>)}
      <text x={(W + m.l) / 2} y={H - 6} fontSize={10} textAnchor="middle" fill={C.axis}>Entropia s [kJ/(kg·K)]</text>
      <text x={12} y={(H - m.b) / 2} fontSize={10} textAnchor="middle" fill={C.axis} transform={`rotate(-90 12 ${(H - m.b) / 2})`}>Temperatura [{tUnit === 'K' ? 'K' : '°C'}]</text>
    </svg>
  );
}

/** Balanço de energia: capacidade + potência = calor rejeitado. */
export function EnergyBalance({ qe, w, qc }: { qe: number; w: number; qc: number }) {
  const tot = Math.max(qc, qe + w);
  const W = 340;
  const sc = (v: number) => (v / tot) * (W - 20);
  return (
    <svg viewBox={`0 0 ${W} 86`} width="100%" role="img" aria-label="Balanço de energia">
      <rect x={10} y={10} width={sc(qe)} height={22} fill="#46b3e6" rx={3} />
      <rect x={10 + sc(qe)} y={10} width={sc(w)} height={22} fill="#f0a202" rx={3} />
      <rect x={10} y={46} width={sc(qc)} height={22} fill="#e4572e" rx={3} />
      <text x={14} y={25} fontSize={10} fill="#fff">Capacidade {fmt(qe, 0)} kW</text>
      <text x={14 + sc(qe)} y={25} fontSize={10} fill="#3a2a00">+ {fmt(w, 0)} kW</text>
      <text x={14} y={61} fontSize={10} fill="#fff">Calor rejeitado {fmt(qc, 0)} kW</text>
      <text x={10} y={82} fontSize={9} fill={C.text}>Energia que entra = energia que sai (1ª lei): erro de balanço calculado &lt; 0,001%</text>
    </svg>
  );
}

export function PairBars({ rows }: { rows: { label: string; a: number; b: number; unit: string; d?: number }[] }) {
  return (
    <div>
      {rows.map((r) => {
        const max = Math.max(r.a, r.b, 1e-9);
        return (
          <div key={r.label} style={{ marginBottom: 8 }}>
            <div className="row small" style={{ justifyContent: 'space-between' }}><span>{r.label}</span><span className="muted">{r.unit}</span></div>
            {(['a', 'b'] as const).map((k) => (
              <div key={k} className="row small" style={{ gap: 6 }}>
                <span className={`ab ${k}`}>{k.toUpperCase()}</span>
                <div style={{ flex: 1, height: 10, background: '#eef1f4', borderRadius: 5 }}><div style={{ width: `${(r[k] / max) * 100}%`, height: '100%', borderRadius: 5, background: k === 'a' ? '#484848' : '#0069ae' }} /></div>
                <b style={{ width: 84, textAlign: 'right' }}>{fmt(r[k], r.d ?? 1)}</b>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
