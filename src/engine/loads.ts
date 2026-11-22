/**
 * Cargas térmicas de câmaras frigoríficas pelo método do ASHRAE Handbook—Refrigeration, cap. 24.
 * Cada componente é calculado como energia diária [kWh/dia] e convertido em potência média.
 */
import { air } from './psychro';
import type { Door, Project } from './types';
import { DOOR_PROTECTION, SOLAR, insulationById } from '../data/materials';
import { PACKAGING, productById, productProps, respiration } from '../data/products';

export type LoadKey = 'transmissao' | 'infiltracao' | 'produto' | 'pessoas' | 'iluminacao' | 'equipamentos' | 'ventiladores' | 'degelo' | 'outras';
export const LOAD_LABEL: Record<LoadKey, string> = {
  transmissao: 'Transmissão', infiltracao: 'Infiltração (portas)', produto: 'Produtos', pessoas: 'Pessoas', iluminacao: 'Iluminação',
  equipamentos: 'Equipamentos / empilhadeiras', ventiladores: 'Ventiladores dos evaporadores', degelo: 'Degelo', outras: 'Outras cargas',
};
export const LOAD_KEYS = Object.keys(LOAD_LABEL) as LoadKey[];

export type Variant = 'nominal' | 'baixo' | 'alto';
const g = 9.81;

export function roomGeometry(p: Project) {
  let L = p.room.length, W = p.room.width;
  if (p.room.areaMode === 'area') {
    L = Math.sqrt(p.room.area * p.room.aspect);
    W = p.room.area / L;
  }
  const H = p.room.height;
  const doorArea = p.doors.reduce((a, d) => a + d.width * d.height * d.count, 0);
  const wallGross = 2 * (L + W) * H;
  return { L, W, H, floor: L * W, volume: L * W * H, wallGross, wallNet: Math.max(0, wallGross - doorArea), roof: L * W, doorArea };
}

export function uValue(lambda: number, thkMm: number, hi = 8, ho = 25) {
  // hi/ho: coeficientes de película típicos (interno com ventilação moderada / externo). Influência pequena.
  return 1 / (1 / hi + thkMm / 1000 / lambda + 1 / ho);
}

/** Infiltração por porta — Gosney & Olama (ASHRAE 2018 Refrigeration, eq. 24.x). Retorna kW médio e vazão de ar seco. */
export function doorInfiltration(d: Door, Tin: number, RHin: number, Df: number, Eoverride?: number) {
  const r = air(Tin, RHin);
  const i = air(d.adjacentT, d.adjacentRH);
  const A = d.width * d.height;
  if (r.rho <= i.rho || i.h <= r.h) return { q: 0, qFull: 0, Dt: 0, mDry: 0, moisture: 0 };
  const Fm = Math.pow(2 / (1 + Math.pow(r.rho / i.rho, 1 / 3)), 1.5);
  const qFull = 0.221 * A * (i.h - r.h) * r.rho * Math.sqrt(1 - i.rho / r.rho) * Math.sqrt(g * d.height) * Fm; // kW com porta aberta
  const passages = d.passagesPerHour * d.hoursPerDay; // por dia
  const thetaO = d.minutesOpenPerHour * d.hoursPerDay; // min/dia
  const Dt = Math.min(1, (passages * d.secondsPerPassage + 60 * thetaO) / (3600 * 24));
  const E = Eoverride ?? DOOR_PROTECTION[d.protection].E;
  const seal = d.sealGood ? 1 : 1.1; // vedação deficiente: +10% (hipótese)
  const q = qFull * Dt * Df * (1 - E) * seal * d.count;
  const mDry = q / (i.h - r.h); // kg ar seco/s médio
  const moisture = Math.max(0, mDry * (i.W - r.W)) * 86400; // kg água/dia que entra
  return { q, qFull, Dt, mDry, moisture };
}

export interface LoadDetail { key: LoadKey; kWhDay: number; avgKW: number; note: string }
export interface LoadResult {
  geometry: ReturnType<typeof roomGeometry>;
  items: LoadDetail[];
  totalKWhDay: number;
  avgKW: number;
  productRateKW: number; // taxa de resfriamento de produto durante o tempo de processo
  capacityAvgBasis: number; // kW: energia diária / horas de operação
  capacityPeakBasis: number; // kW: cargas contínuas + produto concentrado
  requiredKW: number; // com fator de segurança
  frostKgDay: number;
  U: { wall: number; roof: number; floor: number };
  doorDetails: { id: string; kW: number; Dt: number; qFull: number }[];
  processKW?: number;
}

export function computeLoads(p: Project, variant: Variant = 'nominal'): LoadResult {
  const geo = roomGeometry(p);
  const n = Math.max(1, Math.round(p.room.count));
  const items: LoadDetail[] = [];
  const add = (key: LoadKey, kWhDay: number, note: string) => items.push({ key, kWhDay: kWhDay * n, avgKW: (kWhDay * n) / 24, note });
  const s = p.system;
  const vf = variant === 'baixo' ? 0 : variant === 'alto' ? 1 : 0.5; // posição dentro das faixas de incerteza

  if (p.application === 'agua-gelada') {
    const pr = p.process;
    const qProc = (pr.flow / 3600) * 1000 * 4.19 * Math.max(0, pr.Tin - pr.Tout); // kW
    const unc = variant === 'baixo' ? 0.95 : variant === 'alto' ? 1.05 : 1;
    const kWhDay = qProc * pr.hoursPerDay * unc;
    items.push({ key: 'outras', kWhDay, avgKW: kWhDay / 24, note: `Água de processo: ${pr.flow} m³/h de ${pr.Tin} °C para ${pr.Tout} °C durante ${pr.hoursPerDay} h/dia.` });
    const run = pr.strategy === 'banco-gelo' ? Math.min(22, s.runHours) : pr.hoursPerDay;
    const capAvg = kWhDay / run;
    const capPeak = pr.strategy === 'banco-gelo' ? capAvg : qProc * unc;
    return {
      geometry: geo, items, totalKWhDay: kWhDay, avgKW: kWhDay / 24, productRateKW: qProc, capacityAvgBasis: capAvg, capacityPeakBasis: capPeak,
      requiredKW: Math.max(capAvg, capPeak) * (1 + s.safetyFactor), frostKgDay: 0, U: { wall: 0, roof: 0, floor: 0 }, doorDetails: [], processKW: qProc,
    };
  }

  // --- Transmissão
  const ins = insulationById(p.envelope.insulation);
  const lambda = p.envelope.lambdaOverride ?? ins.lambdaRange[0] + (ins.lambdaRange[1] - ins.lambdaRange[0]) * vf;
  const Uw = uValue(lambda, p.envelope.wallThk), Ur = uValue(lambda, p.envelope.roofThk);
  const Uf = p.envelope.floorInsulated ? uValue(lambda, p.envelope.floorThk, 6, 1e6) : 1 / (1 / 6 + 0.2 / 1.4 + 0.5); // piso sem isolamento: laje 20 cm + resistência do solo 0,5 m²K/W (hipótese)
  const Tin = p.room.Tin, Tout = p.climate.Tout;
  const dW = Tout + SOLAR[p.climate.solarWalls].wall - Tin;
  const dR = Tout + SOLAR[p.climate.solarRoof].roof - Tin;
  const dF = p.climate.Tground - Tin;
  const bridge = 1 + p.envelope.thermalBridgePct / 100;
  const qT = (Uw * geo.wallNet * dW + Ur * geo.roof * dR + Uf * geo.floor * Math.max(0, dF) + Uw * 1.3 * geo.doorArea * dW) * bridge / 1000; // kW
  add('transmissao', Math.max(0, qT) * 24, `U parede ${Uw.toFixed(3)} W/m²K (λ=${lambda.toFixed(3)}, ${p.envelope.wallThk} mm); portas com U 30% maior (hipótese); pontes térmicas +${p.envelope.thermalBridgePct}%.`);

  // --- Infiltração pelas portas
  const Df = 0.7 + 0.4 * vf; // fator de fluxo da porta: 0,7–1,1 (ASHRAE); nominal 0,9
  let qInf = 0, moisture = 0;
  const doorDetails: LoadResult['doorDetails'] = [];
  for (const d of p.doors) {
    const pr = DOOR_PROTECTION[d.protection];
    const E = pr.range[1] - (pr.range[1] - pr.range[0]) * vf;
    const r = doorInfiltration(d, Tin, p.room.RHin, Df, E);
    qInf += r.q; moisture += r.moisture;
    doorDetails.push({ id: d.id, kW: r.q * n, Dt: r.Dt, qFull: r.qFull });
  }
  add('infiltracao', qInf * 24, `Gosney & Olama com fator de fluxo Df=${Df.toFixed(2)} e efetividade dos dispositivos de proteção conforme a faixa da literatura.`);

  // --- Produtos
  const prod = productById(p.product.typeId);
  const pp = productProps(prod);
  const pk = PACKAGING.find((x) => x.id === p.product.packaging) ?? PACKAGING[0];
  const m = p.product.dailyMass;
  const T1 = p.product.Tenter, T2 = p.product.Tfinal;
  let eProd = 0; // kJ/dia
  const cpScale = 0.95 + 0.1 * vf;
  if (m > 0 && T1 > T2) {
    if (pp.tFreeze !== null && T1 <= pp.tFreeze) {
      // produto já congelado: apenas calor sensível abaixo do ponto de congelamento
      eProd = m * pp.cpBelow * cpScale * (T1 - T2);
    } else if (pp.tFreeze !== null && T2 < pp.tFreeze) {
      eProd = m * (pp.cpAbove * cpScale * (T1 - pp.tFreeze) + pp.latent + pp.cpBelow * cpScale * (pp.tFreeze - T2));
    } else {
      eProd = m * pp.cpAbove * cpScale * (T1 - T2);
    }
    eProd += m * p.product.packagingFraction * pk.cp * (T1 - T2);
  }
  const resp = (respiration(prod, Tin) * p.product.storedMass) / 1000; // kW
  const productRateKW = (eProd / 3600) / Math.max(0.5, p.product.coolingHours) * n; // kW durante o processo
  add('produto', eProd / 3600 + resp * 24, `${prod.name}: cp ${pp.cpAbove.toFixed(2)}/${pp.cpBelow.toFixed(2)} kJ/kg·K, latente ${pp.latent.toFixed(0)} kJ/kg (Siebel).${resp > 0 ? ` Respiração: ${(resp * 1000).toFixed(0)} W.` : ''}`);

  // --- Pessoas, iluminação, equipamentos
  const qPerson = Math.max(0, 272 - 6 * Tin) / 1000; // kW por pessoa (ASHRAE)
  add('pessoas', p.internal.people * qPerson * p.internal.peopleHours, `${(qPerson * 1000).toFixed(0)} W por pessoa a ${Tin} °C (ASHRAE: 272 − 6·t).`);
  add('iluminacao', (p.internal.lightingWm2 * geo.floor) / 1000 * p.internal.lightingHours, `${p.internal.lightingWm2} W/m² durante ${p.internal.lightingHours} h/dia.`);
  add('equipamentos', p.internal.equipmentKW * p.internal.equipmentHours, 'Potência dissipada no ambiente por empilhadeiras e motores.');

  // --- Degelo (energia que retorna ao ambiente) e resistências de marco de porta
  const frost = Tin < 2 ? moisture : 0;
  const etaD = s.defrostEff + (0.25 - 0.5 * vf) * s.defrostEff;
  let eDef = 0;
  if (frost > 0 && s.defrost !== 'nenhum' && s.defrost !== 'ar') {
    eDef = (frost * (334 + 2.05 * Math.max(0, -Tin))) * (1 / Math.max(0.1, etaD) - 1) / 3600; // kWh/dia
  }
  const heater = Tin < 0 ? p.doors.reduce((a, d) => a + 2 * (d.width + d.height) * d.count, 0) * s.frameHeaterWm / 1000 * 24 : 0;
  add('degelo', eDef + heater, `Gelo formado ≈ ${frost.toFixed(1)} kg/dia (umidade do ar infiltrado); eficiência do degelo ${(etaD * 100).toFixed(0)}% (hipótese).${heater > 0 ? ' Inclui resistências dos marcos das portas.' : ''}`);
  add('outras', p.internal.otherKW * 24, 'Cargas de processo informadas.');

  // --- Ventiladores: potência estimada pela vazão de ar necessária (iterativo, pois o calor dos ventiladores também é carga)
  const base = items.reduce((a, x) => a + x.kWhDay, 0) / n;
  const r = air(Tin, p.room.RHin);
  let fanKW = 0;
  const dp = s.fanDp * (0.85 + 0.3 * vf);
  for (let k = 0; k < 6; k++) {
    const capKW = (base + fanKW * 24) / Math.max(8, s.runHours);
    const Vdot = capKW / (r.rho * 1.006 * s.airDT); // m³/s
    fanKW = (Vdot * dp) / s.fanEta / 1000;
  }
  const fanHours = s.defrost === 'nenhum' || s.defrost === 'ar' ? 24 : 23;
  add('ventiladores', fanKW * fanHours, `Vazão para ΔT do ar de ${s.airDT} K, Δp ${dp.toFixed(0)} Pa e η ${(s.fanEta * 100).toFixed(0)}% (hipóteses).`);

  const total = items.reduce((a, x) => a + x.kWhDay, 0);
  const prodDay = items.find((x) => x.key === 'produto')!.kWhDay;
  const capacityAvgBasis = total / Math.max(8, s.runHours);
  const continuous = (total - prodDay) / Math.max(8, s.runHours);
  const capacityPeakBasis = continuous + (p.product.coolingHours < s.runHours ? productRateKW : prodDay / Math.max(8, s.runHours));
  const requiredKW = Math.max(capacityAvgBasis, capacityPeakBasis) * (1 + s.safetyFactor);
  return { geometry: geo, items, totalKWhDay: total, avgKW: total / 24, productRateKW, capacityAvgBasis, capacityPeakBasis, requiredKW, frostKgDay: frost * n, U: { wall: Uw, roof: Ur, floor: Uf }, doorDetails };
}
