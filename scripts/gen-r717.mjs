// Gera tabelas de propriedades do R717 (amônia) com CoolProp (EOS de referência do CoolProp), referência IIR
// e pontos de referência fora da grade para testes de interpolação. Também gera pontos psicrométricos
// (HAPropsSI) para validar o módulo de psicrometria. Executar: npm run gen:r717
import { writeFileSync, mkdirSync } from 'node:fs';
import Module from 'coolprop-wasm';

const CP = await Module();
const F = 'Ammonia';
const RAW = (o, a, x, b, y) => CP.PropsSI(o, a, x, b, y, F);
const H0 = RAW('H', 'T', 273.15, 'Q', 0) - 200e3, S0 = RAW('S', 'T', 273.15, 'Q', 0) - 1e3;
// Converte para referência IIR; entradas de H/S também são convertidas
const P = (o, a, x, b, y) => {
  const fix = (k, v) => (k === 'H' ? v + H0 : k === 'S' ? v + S0 : v);
  const out = RAW(o, a, fix(a, x), b, fix(b, y));
  return o === 'H' ? out - H0 : o === 'S' ? out - S0 : out;
};
const K = 273.15;
const r = (v, n = 6) => Number(v.toPrecision(n));

// Saturação: -70 °C a +120 °C, passo 1 K
const sat = { T: [], P: [], rhoL: [], rhoV: [], hL: [], hV: [], sL: [], sV: [], cpL: [], cpV: [] };
for (let t = -70; t <= 120; t += 1) {
  const T = t + K;
  sat.T.push(t);
  sat.P.push(r(P('P', 'T', T, 'Q', 0) / 1000)); // kPa
  sat.rhoL.push(r(P('D', 'T', T, 'Q', 0)));
  sat.rhoV.push(r(P('D', 'T', T, 'Q', 1)));
  sat.hL.push(r(P('H', 'T', T, 'Q', 0) / 1000)); // kJ/kg
  sat.hV.push(r(P('H', 'T', T, 'Q', 1) / 1000));
  sat.sL.push(r(P('S', 'T', T, 'Q', 0) / 1000)); // kJ/kg.K
  sat.sV.push(r(P('S', 'T', T, 'Q', 1) / 1000));
  sat.cpL.push(r(P('C', 'T', T, 'Q', 0) / 1000));
  sat.cpV.push(r(P('C', 'T', T, 'Q', 1) / 1000));
}

// Vapor superaquecido: grade (Tsat, superaquecimento) para garantir pontos sempre válidos
const supTsat = [];
for (let t = -70; t <= 110; t += 5) supTsat.push(t);
const supDT = [0.5, 2, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200, 220, 240, 260, 280];
const sup = { Tsat: supTsat, dT: supDT, h: [], s: [], rho: [] };
for (const ts of supTsat) {
  const Pp = P('P', 'T', ts + K, 'Q', 1);
  const hr = [], sr = [], dr = [];
  for (const dt of supDT) {
    const T = ts + K + dt;
    hr.push(r(P('H', 'P', Pp, 'T', T) / 1000));
    sr.push(r(P('S', 'P', Pp, 'T', T) / 1000));
    dr.push(r(P('D', 'P', Pp, 'T', T)));
  }
  sup.h.push(hr); sup.s.push(sr); sup.rho.push(dr);
}

// Pontos de referência fora da grade (para testes)
const ref = [];
for (const [ts, dt] of [[-33.3, 7.3], [-12.7, 23.4], [2.2, 61.1], [27.5, 3.3], [41.8, 88.8], [-41.1, 112]]) {
  const Pp = P('P', 'T', ts + K, 'Q', 1);
  ref.push({ Tsat: ts, dT: dt, P: Pp / 1000, h: P('H', 'P', Pp, 'T', ts + K + dt) / 1000, s: P('S', 'P', Pp, 'T', ts + K + dt) / 1000, rho: P('D', 'P', Pp, 'T', ts + K + dt) });
}
const refSat = [-38.4, -25.5, -10.1, 0, 12.3, 35.7, 48.9].map((t) => ({
  T: t, P: P('P', 'T', t + K, 'Q', 0) / 1000, hL: P('H', 'T', t + K, 'Q', 0) / 1000, hV: P('H', 'T', t + K, 'Q', 1) / 1000,
  sL: P('S', 'T', t + K, 'Q', 0) / 1000, sV: P('S', 'T', t + K, 'Q', 1) / 1000, rhoV: P('D', 'T', t + K, 'Q', 1),
}));
// Compressão isentrópica de referência: vapor saturado em Te -> Pcond
const refIsen = [[-10, 35], [-30, 35], [-40, 30], [0, 40]].map(([te, tc]) => {
  const s1 = P('S', 'T', te + K, 'Q', 1);
  const pc = P('P', 'T', tc + K, 'Q', 0);
  return { Te: te, Tc: tc, h2s: P('H', 'P', pc, 'S', s1) / 1000, T2s: P('T', 'P', pc, 'S', s1) - K };
});

// Psicrometria (ar úmido, 101325 Pa)
const psy = [[35, 0.5], [25, 0.6], [5, 0.85], [0, 0.9], [-18, 0.9], [-25, 0.8], [30, 0.7]].map(([t, rh]) => ({
  T: t, RH: rh,
  W: CP.HAPropsSI('W', 'T', t + K, 'P', 101325, 'R', rh),
  h: CP.HAPropsSI('H', 'T', t + K, 'P', 101325, 'R', rh) / 1000,
  v: CP.HAPropsSI('V', 'T', t + K, 'P', 101325, 'R', rh),
}));

const crit = { Tc: P('Tcrit', '', 0, '', 0) - K, Pc: P('Pcrit', '', 0, '', 0) / 1000, M: P('M', '', 0, '', 0) * 1000 };
const meta = {
  source: 'CoolProp 6.6.0 (coolprop-wasm), PropsSI/HAPropsSI, fluido "Ammonia" (equação de estado de referência adotada pelo CoolProp para a amônia). Referência de entalpia/entropia: IIR (h=200 kJ/kg, s=1 kJ/kg.K para líquido saturado a 0 °C)',
  generated: new Date().toISOString().slice(0, 10),
  units: 'T °C, P kPa, h kJ/kg, s kJ/(kg·K), rho kg/m³, cp kJ/(kg·K)',
  referenceCheck: { hL_0C: sat.hL[70], sL_0C: sat.sL[70] },
};

mkdirSync('src/data/generated', { recursive: true });
writeFileSync('src/data/generated/r717.json', JSON.stringify({ meta, crit, sat, sup }));
writeFileSync('src/data/generated/r717-reference.json', JSON.stringify({ ref, refSat, refIsen, psy }, null, 1));
console.log('ok', meta, crit);
