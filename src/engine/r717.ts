/**
 * Propriedades termodinâmicas do R717 (amônia) por interpolação de tabelas geradas com CoolProp.
 * Referência IIR: h = 200 kJ/kg e s = 1 kJ/(kg·K) para líquido saturado a 0 °C.
 * Domínio: saturação de -70 °C a +120 °C; vapor superaquecido até +200 K de superaquecimento.
 * Unidades: T [°C], P [kPa], h [kJ/kg], s [kJ/(kg·K)], rho [kg/m³].
 */
import table from '../data/generated/r717.json';

type Sat = typeof table.sat;
const sat: Sat = table.sat;
const sup = table.sup;
export const R717_META = table.meta;
export const R717_CRIT = table.crit;
export const T_MIN = sat.T[0];
export const T_MAX = sat.T[sat.T.length - 1];

export class PropertyDomainError extends Error {}

const lnP = sat.P.map(Math.log);
const lnRhoV = sat.rhoV.map(Math.log);

function bracket(arr: number[], x: number): [number, number] {
  // arr crescente; retorna índice i e fração f com x = arr[i] + f*(arr[i+1]-arr[i])
  const n = arr.length;
  if (x <= arr[0]) return [0, (x - arr[0]) / (arr[1] - arr[0])];
  if (x >= arr[n - 1]) return [n - 2, (x - arr[n - 2]) / (arr[n - 1] - arr[n - 2])];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= x) lo = m; else hi = m;
  }
  return [lo, (x - arr[lo]) / (arr[lo + 1] - arr[lo])];
}
/** Interpolação cúbica de Catmull-Rom (passo uniforme) para reduzir o erro de interpolação linear. */
function cubic(y: number[], i: number, f: number): number {
  const n = y.length;
  const y0 = y[Math.max(0, i - 1)], y1 = y[i], y2 = y[Math.min(n - 1, i + 1)], y3 = y[Math.min(n - 1, i + 2)];
  if (i === 0 || i >= n - 2) return y1 + f * (y2 - y1);
  return y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0)));
}

function checkT(T: number) {
  if (!(T >= T_MIN && T <= T_MAX)) throw new PropertyDomainError(`Temperatura de saturação ${T.toFixed(1)} °C fora do domínio da tabela (${T_MIN} a ${T_MAX} °C).`);
}

export interface SatProps { T: number; P: number; rhoL: number; rhoV: number; hL: number; hV: number; sL: number; sV: number; cpL: number; cpV: number; hfg: number }

export function satT(T: number): SatProps {
  checkT(T);
  const [i, f] = bracket(sat.T, T);
  const c = (a: number[]) => cubic(a, i, f);
  const hL = c(sat.hL), hV = c(sat.hV);
  return {
    T, P: Math.exp(c(lnP)), rhoL: c(sat.rhoL), rhoV: Math.exp(c(lnRhoV)), hL, hV, sL: c(sat.sL), sV: c(sat.sV), cpL: c(sat.cpL), cpV: c(sat.cpV), hfg: hV - hL,
  };
}

/** Temperatura de saturação [°C] para pressão [kPa]. */
export function tSat(P: number): number {
  const lp = Math.log(P);
  if (!(lp >= lnP[0] && lp <= lnP[lnP.length - 1])) throw new PropertyDomainError(`Pressão ${P.toFixed(1)} kPa fora do domínio de saturação.`);
  // inversão: chute linear seguido de Newton sobre a interpolação cúbica
  const [i, f] = bracket(lnP, lp);
  let T = sat.T[i] + f;
  for (let k = 0; k < 6; k++) {
    const p1 = Math.log(satT(Math.min(T_MAX, Math.max(T_MIN, T))).P);
    const dT = 0.01;
    const p2 = Math.log(satT(Math.min(T_MAX, Math.max(T_MIN, T + dT))).P);
    T -= (p1 - lp) / ((p2 - p1) / dT);
  }
  return T;
}
export const pSat = (T: number) => satT(T).P;

// ---- Vapor superaquecido: grade (Tsat, ΔT) com coluna ΔT=0 da saturação
const dTs = [0, ...sup.dT];
function supRow(key: 'h' | 's' | 'rho', i: number): number[] {
  const tsat = sup.Tsat[i];
  const s0 = satT(tsat);
  const v0 = key === 'h' ? s0.hV : key === 's' ? s0.sV : s0.rhoV;
  return [v0, ...(sup[key][i] as number[])];
}
const rows = { h: sup.Tsat.map((_, i) => supRow('h', i)), s: sup.Tsat.map((_, i) => supRow('s', i)), rho: sup.Tsat.map((_, i) => supRow('rho', i).map(Math.log)) };

function supInterp(key: 'h' | 's' | 'rho', Tsat: number, dT: number): number {
  if (dT < 0) throw new PropertyDomainError('Superaquecimento negativo: o estado não é vapor superaquecido.');
  if (dT > dTs[dTs.length - 1]) throw new PropertyDomainError(`Superaquecimento ${dT.toFixed(0)} K acima do domínio (${dTs[dTs.length - 1]} K).`);
  if (Tsat < sup.Tsat[0] || Tsat > sup.Tsat[sup.Tsat.length - 1]) throw new PropertyDomainError(`Saturação ${Tsat.toFixed(1)} °C fora da grade de vapor.`);
  const [i, fi] = bracket(sup.Tsat, Tsat);
  const [j, fj] = bracket(dTs, dT);
  const g = rows[key];
  // ao longo de ΔT: linear por partes (grade não uniforme), corrigida pelo valor de saturação exato
  const along = (r: number[]) => r[j] + fj * (r[j + 1] - r[j]);
  const v = along(g[i]) * (1 - fi) + along(g[i + 1]) * fi;
  // correção na saturação: substitui o erro de interpolação em Tsat pelo valor exato da curva
  const s0 = satT(Tsat);
  const exact0 = key === 'h' ? s0.hV : key === 's' ? s0.sV : Math.log(s0.rhoV);
  const interp0 = g[i][0] * (1 - fi) + g[i + 1][0] * fi;
  const val = v + (exact0 - interp0);
  return key === 'rho' ? Math.exp(val) : val;
}

export interface State { P: number; T: number; h: number; s: number; rho: number; x: number | null; phase: 'liquido' | 'bifasico' | 'vapor' }

/** Vapor superaquecido a partir de P [kPa] e T [°C]. */
export function vaporPT(P: number, T: number): State {
  const ts = tSat(P);
  const dT = T - ts;
  return { P, T, h: supInterp('h', ts, dT), s: supInterp('s', ts, dT), rho: supInterp('rho', ts, dT), x: null, phase: 'vapor' };
}

function solveDT(ts: number, key: 'h' | 's', target: number): number {
  let lo = 0, hi = dTs[dTs.length - 1];
  if (supInterp(key, ts, lo) > target) return 0;
  if (supInterp(key, ts, hi) < target) throw new PropertyDomainError('Estado fora do domínio de vapor superaquecido (temperatura muito alta).');
  for (let k = 0; k < 60; k++) {
    const m = 0.5 * (lo + hi);
    if (supInterp(key, ts, m) < target) lo = m; else hi = m;
  }
  return 0.5 * (lo + hi);
}

/** Estado genérico a partir de P e h (líquido, bifásico ou vapor). */
export function statePh(P: number, h: number): State {
  const ts = tSat(P);
  const s = satT(ts);
  if (h <= s.hL) {
    // líquido sub-resfriado: aproximação de líquido incompressível, h ≈ hL(T)
    let lo = T_MIN, hi = ts;
    for (let k = 0; k < 50; k++) { const m = 0.5 * (lo + hi); if (satT(m).hL < h) lo = m; else hi = m; }
    const T = 0.5 * (lo + hi);
    const l = satT(T);
    return { P, T, h, s: l.sL, rho: l.rhoL, x: null, phase: 'liquido' };
  }
  if (h < s.hV) {
    const x = (h - s.hL) / s.hfg;
    return { P, T: ts, h, s: s.sL + x * (s.sV - s.sL), rho: 1 / (x / s.rhoV + (1 - x) / s.rhoL), x, phase: 'bifasico' };
  }
  const dT = solveDT(ts, 'h', h);
  return { ...vaporPT(P, ts + dT), h };
}

/** Estado de vapor a partir de P e s (usado na compressão isentrópica). */
export function vaporPs(P: number, s: number): State {
  const ts = tSat(P);
  const dT = solveDT(ts, 's', s);
  return { ...vaporPT(P, ts + dT), s };
}

export function satLiquid(T: number): State {
  const s = satT(T);
  return { P: s.P, T, h: s.hL, s: s.sL, rho: s.rhoL, x: 0, phase: 'liquido' };
}
export function satVapor(T: number): State {
  const s = satT(T);
  return { P: s.P, T, h: s.hV, s: s.sV, rho: s.rhoV, x: 1, phase: 'vapor' };
}
/** Líquido sub-resfriado a T, na pressão P (aproximação h≈hL(T)). */
export function subcooledLiquid(P: number, T: number): State {
  const l = satT(T);
  return { P, T, h: l.hL, s: l.sL, rho: l.rhoL, x: null, phase: 'liquido' };
}

/** Dados para desenhar a cúpula de saturação e isotermas (diagramas P-h e T-s). */
export function domeData(step = 2) {
  const out: SatProps[] = [];
  for (let t = T_MIN; t <= T_MAX; t += step) out.push(satT(t));
  return out;
}
export function isotherm(T: number, Pmin: number, Pmax: number, n = 30): { P: number; h: number; s: number }[] {
  // isoterma: líquido (vertical aproximada) + patamar + vapor superaquecido em pressões menores
  const pts: { P: number; h: number; s: number }[] = [];
  const s0 = T <= T_MAX ? satT(Math.min(T, T_MAX)) : null;
  if (s0 && T <= T_MAX) {
    pts.push({ P: Pmax, h: s0.hL, s: s0.sL });
    pts.push({ P: s0.P, h: s0.hL, s: s0.sL });
    pts.push({ P: s0.P, h: s0.hV, s: s0.sV });
  }
  const top = s0 ? Math.min(s0.P, Pmax) : Pmax;
  for (let k = 1; k <= n; k++) {
    const P = top * Math.pow(Pmin / top, k / n);
    try {
      const ts = tSat(P);
      if (T - ts > 0 && T - ts <= dTs[dTs.length - 1] && ts >= sup.Tsat[0]) {
        const st = vaporPT(P, T);
        pts.push({ P, h: st.h, s: st.s });
      }
    } catch { /* fora do domínio */ }
  }
  return pts;
}
