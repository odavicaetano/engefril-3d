/** Integra cargas, ciclo e energia; classifica a qualidade dos dados e gera conclusões sustentadas pelos números. */
import { computeLoads, LOAD_LABEL, type LoadKey, type LoadResult } from './loads';
import { ARCHITECTURES, computeCycle, type CycleResult } from './cycle';
import { wetBulb } from './psychro';
import type { ConfirmKey, Project } from './types';

export type Quality = 'exploratorio' | 'preliminar' | 'detalhado';
export const QUALITY_INFO: Record<Quality, { label: string; extra: number; desc: string }> = {
  exploratorio: { label: 'Exploratório', extra: 0.2, desc: 'Poucos dados confirmados e hipóteses amplas. Serve para ordem de grandeza.' },
  preliminar: { label: 'Preliminar', extra: 0.1, desc: 'Dados suficientes para uma estimativa inicial de capacidade.' },
  detalhado: { label: 'Detalhado', extra: 0.05, desc: 'Dados operacionais completos. Ainda não é um projeto executivo validado.' },
};
const CRITICAL: ConfirmKey[] = ['dimensoes', 'temperaturas', 'produto', 'portas', 'isolamento'];
const ALL: ConfirmKey[] = ['dimensoes', 'temperaturas', 'portas', 'produto', 'isolamento', 'internas', 'clima', 'operacao'];

export function quality(p: Project): Quality {
  const c = p.confirmed;
  const nCrit = CRITICAL.filter((k) => c[k]).length;
  if (ALL.every((k) => c[k])) return 'detalhado';
  if (c.dimensoes && c.temperaturas && nCrit >= 3) return 'preliminar';
  return 'exploratorio';
}
export function missingData(p: Project): string[] {
  const names: Record<ConfirmKey, string> = {
    dimensoes: 'Dimensões reais e layout da câmara', temperaturas: 'Temperatura interna e umidade de projeto', portas: 'Quantidade, tamanho e regime de abertura das portas',
    produto: 'Tipo de produto, massa diária e temperaturas de entrada e saída', isolamento: 'Especificação do isolamento (material e espessura)', internas: 'Ocupação, iluminação e equipamentos internos',
    clima: 'Condições climáticas de projeto do local (bulbo seco e úmido)', operacao: 'Regime de operação, degelo e tarifa de energia',
  };
  const list = ALL.filter((k) => !p.confirmed[k]).map((k) => names[k]);
  return [...list, 'Levantamento em campo, layout da sala de máquinas e traçado de tubulação', 'Seleção de equipamentos com dados de catálogo do fabricante (capacidades certificadas)', 'Análise de risco e requisitos de segurança (NR-13, ABNT NBR 16069, IIAR)'];
}

export function designTemps(p: Project) {
  const twb = wetBulb(p.climate.Tout, p.climate.RHout);
  const Tc = Math.min(50, Math.max(25, twb + p.system.condApproach));
  let Te: number;
  if (p.application === 'agua-gelada') {
    Te = p.process.strategy === 'banco-gelo' ? -10 : p.process.Tout - 5;
  } else {
    Te = p.room.Tin - p.system.evapTD - 1; // -1 K: penalidade equivalente de perda de carga na sucção (hipótese)
    if (p.system.architecture === 'indireto') Te -= 6; // aproximação do fluido secundário + trocador (hipótese)
  }
  return { twb, Tc, Te };
}

export interface Evaluation {
  loads: { nominal: LoadResult; baixo: LoadResult; alto: LoadResult };
  range: [number, number]; // kW requerido (com margem de qualidade)
  quality: Quality;
  temps: ReturnType<typeof designTemps>;
  cycle: CycleResult;
  energy: { compKW: number; auxKW: number; fanKW: number; pumpKW: number; totalElecKW: number; kWhDay: number; kWhYear: number; costYear: number; seasonalNote: string };
  insights: string[];
  missing: string[];
  breakdown: { key: LoadKey; label: string; kWhDay: number; share: number }[];
}

export function evaluate(p: Project): Evaluation {
  const nominal = computeLoads(p, 'nominal');
  const baixo = computeLoads(p, 'baixo');
  const alto = computeLoads(p, 'alto');
  const q = quality(p);
  const ex = QUALITY_INFO[q].extra;
  const range: [number, number] = [baixo.requiredKW * (1 - ex), alto.requiredKW * (1 + ex)];
  const temps = designTemps(p);
  const cycle = computeCycle({
    Te: temps.Te, Tc: temps.Tc, superheat: p.system.superheat, subcool: p.system.subcool, etaIs: p.system.etaIs, etaMotor: p.system.etaMotor,
    architecture: p.application === 'agua-gelada' ? 'indireto' : p.system.architecture, capacity: Math.max(0.1, nominal.requiredKW),
  });
  if (p.application === 'agua-gelada') cycle.Wpump = 0; // bomba de água de processo não incluída

  // Energia diária: carga térmica diária / COP + auxiliares
  const fan = nominal.items.find((i) => i.key === 'ventiladores') ?? { kWhDay: 0 };
  const fanKW = fan.kWhDay / 24;
  const cop = cycle.errors.length ? NaN : nominal.requiredKW / cycle.Welec;
  const kWhThermal = nominal.totalKWhDay;
  const compKWhDay = kWhThermal / cop;
  const auxFrac = p.system.condAuxPct / 100;
  const auxKWhDay = auxFrac * (kWhThermal + compKWhDay);
  const pumpKWhDay = cycle.Wpump * Math.min(24, p.system.runHours);
  const kWhDay = compKWhDay + auxKWhDay + fan.kWhDay + pumpKWhDay;
  const kWhYear = kWhDay * p.finance.operatingDays;
  const energy = {
    compKW: cycle.Welec, auxKW: auxFrac * cycle.Qc, fanKW, pumpKW: cycle.Wpump,
    totalElecKW: cycle.Welec + auxFrac * cycle.Qc + fanKW + cycle.Wpump,
    kWhDay, kWhYear, costYear: kWhYear * p.finance.tariff,
    seasonalNote: 'Consumo calculado na condição de projeto (verão). Em clima mais ameno, a condensação flutuante reduz o consumo real; o valor é conservador.',
  };

  // Decomposição
  const tot = nominal.totalKWhDay || 1;
  const breakdown = nominal.items.filter((i) => i.kWhDay > 0).map((i) => ({ key: i.key, label: LOAD_LABEL[i.key], kWhDay: i.kWhDay, share: i.kWhDay / tot })).sort((a, b) => b.kWhDay - a.kWhDay);

  // Conclusões: somente quando os números sustentam
  const insights: string[] = [];
  const share = (k: LoadKey) => breakdown.find((b) => b.key === k)?.share ?? 0;
  if (share('infiltracao') >= 0.3) {
    const worst = [...nominal.doorDetails].sort((a, b) => b.kW - a.kW)[0];
    insights.push(`A entrada de ar pelas portas responde por ${(share('infiltracao') * 100).toFixed(0)}% da carga térmica estimada. Reduzir o tempo de abertura ou instalar uma proteção (cortina de PVC, cortina de ar ou antecâmara) pode diminuir a demanda de refrigeração${worst ? `; a porta mais crítica contribui com cerca de ${worst.kW.toFixed(1)} kW médios` : ''}.`);
  }
  if (share('transmissao') >= 0.35) insights.push(`A transmissão pelas paredes, teto e piso responde por ${(share('transmissao') * 100).toFixed(0)}% da carga. Vale comparar espessuras de isolamento maiores no comparador de cenários.`);
  if (share('produto') >= 0.4) insights.push(`O resfriamento ou congelamento dos produtos domina a carga (${(share('produto') * 100).toFixed(0)}%). A temperatura de entrada e o tempo de processo são os dados mais importantes a confirmar.`);
  if (nominal.capacityPeakBasis > nominal.capacityAvgBasis * 1.3) insights.push('A capacidade é definida pelo pico de resfriamento de produto, não pela média diária. Alongar o tempo de resfriamento reduziria a potência instalada.');
  if (p.application === 'agua-gelada' && p.process.strategy === 'chiller' && p.process.Tout < 3) insights.push('Água gelada abaixo de cerca de +3 °C em trocador a placas traz risco de congelamento. Um banco de gelo (tanque de acumulação) atende +1 a +2 °C e reduz a potência instalada quando a carga é concentrada em picos.');
  if (p.application === 'agua-gelada' && p.process.strategy === 'banco-gelo' && nominal.processKW) insights.push(`Com acumulação de gelo, a capacidade frigorífica cai de ${nominal.processKW.toFixed(0)} kW (pico) para cerca de ${nominal.requiredKW.toFixed(0)} kW, porque a produção de gelo se distribui ao longo do dia. Em troca, a evaporação mais baixa reduz o COP.`);
  insights.push(...cycle.warnings);

  return { loads: { nominal, baixo, alto }, range, quality: q, temps, cycle, energy, insights, missing: missingData(p), breakdown };
}

/** Sensibilidade: variação da capacidade requerida quando cada parâmetro varia ±10% (ou ±passo físico). */
export function sensitivity(p: Project): { label: string; low: number; high: number }[] {
  const base = computeLoads(p).requiredKW;
  const tests: { label: string; apply: (q: Project, s: number) => void }[] = [
    { label: 'Temperatura externa ±3 K', apply: (q, s) => { q.climate.Tout += 3 * s; q.doors.forEach((d) => (d.adjacentT += 3 * s)); } },
    { label: 'Temperatura interna ±2 K', apply: (q, s) => { q.room.Tin += 2 * s; } },
    { label: 'Passagens pelas portas ±30%', apply: (q, s) => q.doors.forEach((d) => (d.passagesPerHour *= 1 + 0.3 * s)) },
    { label: 'Espessura do isolamento ∓25 mm', apply: (q, s) => { q.envelope.wallThk -= 25 * s; q.envelope.roofThk -= 25 * s; } },
    { label: 'Massa diária de produto ±20%', apply: (q, s) => { q.product.dailyMass *= 1 + 0.2 * s; } },
    { label: 'Temperatura de entrada do produto ±5 K', apply: (q, s) => { q.product.Tenter += 5 * s; } },
    { label: 'Horas de operação do compressor ∓2 h', apply: (q, s) => { q.system.runHours -= 2 * s; } },
  ];
  return tests.map((t) => {
    const a = structuredClone(p); t.apply(a, -1);
    const b = structuredClone(p); t.apply(b, 1);
    return { label: t.label, low: computeLoads(a).requiredKW - base, high: computeLoads(b).requiredKW - base };
  }).sort((x, y) => Math.abs(y.high - y.low) - Math.abs(x.high - x.low));
}

/** Mesmas cargas e condensação, outras arquiteturas: ciclo, COP e potência de cada uma (indireto: evaporação 6 K menor, hipótese). */
export function compareArchitectures(p: Project, e: Evaluation) {
  return ARCHITECTURES.map((a) => {
    let Te = e.temps.Te;
    if (a.id === 'indireto' && p.system.architecture !== 'indireto') Te -= 6;
    if (a.id !== 'indireto' && p.system.architecture === 'indireto') Te += 6;
    const c = computeCycle({ Te, Tc: e.temps.Tc, superheat: p.system.superheat, subcool: p.system.subcool, etaIs: p.system.etaIs, etaMotor: p.system.etaMotor, architecture: a.id, capacity: e.loads.nominal.requiredKW });
    return { id: a.id, name: a.name, Te, cycle: c };
  });
}

export interface Comparison { dKWh: number; dCost: number; dCap: number; payback: number | null; note: string }
export function compare(a: Project, ea: Evaluation, b: Project, eb: Evaluation): Comparison {
  const dKWh = ea.energy.kWhYear - eb.energy.kWhYear;
  const dCost = ea.energy.costYear - eb.energy.costYear;
  const inv = b.finance.investment != null && a.finance.investment != null ? b.finance.investment - a.finance.investment : b.finance.investment;
  const payback = inv != null && inv > 0 && dCost > 0 ? inv / dCost : null;
  const note = inv == null ? 'Payback não calculado: informe o investimento adicional (preço de fornecimento sujeito a orçamento técnico-comercial).' : dCost <= 0 ? 'O cenário B não reduz o custo de energia estimado; payback não se aplica.' : 'Payback simples, sem custo de capital, inflação tarifária ou manutenção.';
  return { dKWh, dCost, dCap: ea.loads.nominal.requiredKW - eb.loads.nominal.requiredKW, payback, note };
}
