/**
 * Relatório Técnico Completo em A4: capa, sumário, memorial descritivo, memorial de cálculo, desenhos técnicos
 * vetoriais cotados, especificação de equipamentos, quadro de dimensionamento, análise energética e conclusões.
 *
 * Convenções adotadas (referências de prática usual, sem validação normativa formal):
 * - Folhas de desenho com margem esquerda de 25 mm e demais de 7 mm e legenda (carimbo) no canto inferior direito (ABNT NBR 10068).
 * - Cotas em metros, com linhas de chamada e setas (ABNT NBR 10126); escalas normalizadas (ABNT NBR 8196).
 * - Linhas tracejadas para elementos acima do plano de corte, como os evaporadores suspensos (ABNT NBR 8403).
 * Todo número vem do motor de cálculo (evaluate/computeLoads/computeCycle): nada é digitado à mão aqui.
 */
import { jsPDF } from 'jspdf';
import type { Project } from '../engine/types';
import { evaluate, compare, compareArchitectures, QUALITY_INFO } from '../engine/analysis';
import { suggestEquipment } from '../engine/suggest';
import { LOAD_LABEL } from '../engine/loads';
import { ARCHITECTURES } from '../engine/cycle';
import { satT } from '../engine/r717';
import { productById } from '../data/products';
import { insulationById, DOOR_PROTECTION, DOOR_TYPES, SOLAR } from '../data/materials';
import { APPLICATIONS } from '../data/scenarios';
import { SOURCES } from '../data/sources';
import { computeLayout, placeDoors, doorWorldX, LINE_INFO, type Layout, type LineKind, type PlacedDoor } from '../scene/layout';
import { BLUE, NAVY, GREY, INK, LIGHT, clean, n, brl, hex, chooseScale, slug, type RGB } from './common';
import { PdfComposer, type Orientation } from './kit';
import { equipmentSchedule, equipmentTags } from './specs';

export type { Orientation };
export type Section = 'descritivo' | 'calculo' | 'desenhos' | 'equipamentos' | 'dimensionamento' | 'energia' | 'conclusoes';
export const SECTIONS: { id: Section; label: string }[] = [
  { id: 'descritivo', label: 'Memorial descritivo' }, { id: 'calculo', label: 'Memorial de cálculo' }, { id: 'desenhos', label: 'Desenhos técnicos' },
  { id: 'equipamentos', label: 'Especificação de equipamentos' }, { id: 'dimensionamento', label: 'Quadro de dimensionamento' }, { id: 'energia', label: 'Análise energética' }, { id: 'conclusoes', label: 'Conclusões técnicas' },
];
export interface TechOptions { orientation: Orientation; revision: string; compare?: Project | null; image?: string | null; date?: Date; compress?: boolean; client?: string; sections?: Section[] }

const DISCLAIMER = 'PRÉ-DIMENSIONAMENTO ORIENTATIVO: não é projeto executivo, não foi verificado nem aprovado por profissional habilitado e não substitui ART, memorial assinado ou seleção de catálogo.';

export { equipmentTags } from './specs';

export function buildTechnicalReport(p: Project, opts: TechOptions): jsPDF {
  const ev = evaluate(p);
  const l = computeLayout(p);
  const tags = equipmentTags(l);
  const doors = l.water ? [] : placeDoors(p, l.L, l.W);
  const doorTag = (pd: PlacedDoor) => `P-${String(p.doors.indexOf(pd.door) + 1).padStart(2, '0')}${pd.door.count > 1 ? String.fromCharCode(97 + pd.idx) : ''}`;
  const date = (opts.date ?? new Date()).toLocaleDateString('pt-BR');
  const rev = opts.revision || 'R0';
  const code = `E3D-${(p.name.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'PROJ').toUpperCase()}`;

  const K = new PdfComposer({
    title: `Relatório Técnico de Pré-dimensionamento: ${p.name}`, shortTitle: 'Relatório Técnico de Pré-dimensionamento',
    subject: 'Pré-dimensionamento orientativo de refrigeração industrial (R717)', code, revision: rev, date, project: p.name, client: opts.client,
    classification: 'Estudo preliminar', disclaimer: DISCLAIMER,
  }, { orientation: opts.orientation, compress: opts.compress });
  const doc = K.doc;
  const { newPage, font, para, bullets, formula, kv, note, page, barChart } = K;
  const table = K.TechnicalTable;
  let secN = 0, subN = 0;
  const h1 = (t: string) => { subN = 0; K.SectionTitle(`${++secN}. ${t.replace(/^\d+\.\s*/, '')}`); };
  const h2 = (t: string) => K.SubTitle(`${secN}.${++subN} ${t.replace(/^\d+\.\d+\s*/, '')}`);
  const T = { line: K.line, dash: K.dash };
  const area = K.drawingArea, sheetHead = K.sheetHead, dimH = K.dimH, dimV = K.dimV, scaleBar = K.scaleBar;
  const m2 = (v: number) => n(v, 2);
  const toc = K.toc;
  const sec = (s: Section) => !opts.sections || opts.sections.includes(s);

  // ================= CAPA =================
  {
    const app = APPLICATIONS.find((a) => a.id === p.application)?.name ?? p.application;
    const g = ev.loads.nominal.geometry;
    const rows: [string, string][] = [
      ['Documento', `${code} · Relatório Técnico Completo`], ...(opts.client ? [['Cliente', opts.client] as [string, string]] : []), ['Classificação', 'Estudo preliminar (pré-dimensionamento orientativo)'], ['Revisão / data', `${rev} · ${date}`],
      ['Aplicação', app], ['Refrigerante / arquitetura', `R717 (amônia) · ${ARCHITECTURES.find((a) => a.id === l.arch)?.name}`],
      ...(p.application === 'agua-gelada'
        ? [['Processo', `${n(p.process.flow, 1)} m³/h · ${p.process.Tin} -> ${p.process.Tout} °C · ${p.process.hoursPerDay} h/dia`] as [string, string]]
        : [['Câmara(s)', `${p.room.count} × ${n(g.L, 2)} × ${n(g.W, 2)} × ${n(g.H, 2)} m (C × L × A internos) · ${p.room.Tin} °C`] as [string, string], ['Área / volume totais', `${n(g.floor * p.room.count, 1)} m² · ${n(g.volume * p.room.count, 0)} m³`] as [string, string]]),
      ['Capacidade frigorífica estimada', ev.cycle.errors.length ? 'sem cálculo válido' : `${n(ev.loads.nominal.requiredKW, 1)} kW nominal (faixa ${n(ev.range[0], 0)} a ${n(ev.range[1], 0)} kW)`],
      ['Qualidade dos dados', `${QUALITY_INFO[ev.quality].label}: ${QUALITY_INFO[ev.quality].desc}`],
      ['Responsável técnico', 'Não atribuído. Documento sem ART e sem assinatura.'],
    ];
    K.Cover(rows, opts.image);
  }

  // ================= SUMÁRIO (preenchido ao final) =================
  newPage('texto');
  const tocPage = page();

  // ================= 1. MEMORIAL DESCRITIVO =================
  const sys = p.system;
  const archName = ARCHITECTURES.find((a) => a.id === l.arch);
  const prod = productById(p.product.typeId);
  const ins = insulationById(p.envelope.insulation);
  const g = ev.loads.nominal.geometry;
  const water = p.application === 'agua-gelada';
  const nEv = Math.max(1, l.evaps.length);
  const m = ev.loads.nominal.memo;
  const items = Object.fromEntries(ev.loads.nominal.items.map((i) => [i.key, i]));
  const c = ev.cycle;
  const e = ev.energy;
  const evKW = ev.loads.nominal.requiredKW / (nEv * Math.max(1, p.room.count));
  const comps = l.equips.filter((e) => e.kind === 'compressor');
  if (sec('descritivo')) {
  h1('1. Memorial descritivo');
  h2('1.1 Objetivo do documento');
  para(`Este documento reúne o pré-dimensionamento orientativo do cenário "${p.name}", gerado pela plataforma ENGEFRIL 3D a partir dos dados informados pelo usuário. Ele serve à análise preliminar por engenheiros e à apresentação comercial. Os resultados são estimativas de regime permanente na condição de projeto e devem ser confirmados por projeto executivo elaborado por profissional habilitado.`);
  h2('1.2 Finalidade do sistema');
  const appP = APPLICATIONS.find((a) => a.id === p.application);
  para(water
    ? `Produzir água gelada para processo: ${n(p.process.flow, 1)} m³/h resfriados de ${p.process.Tin} °C para ${p.process.Tout} °C durante ${p.process.hoursPerDay} h/dia, com estratégia de ${p.process.strategy === 'banco-gelo' ? 'acumulação em banco de gelo (tanque de água gelada de NH3)' : 'resfriamento direto em chiller com trocador a placas'}.`
    : `${appP?.name ?? 'Câmara frigorífica'} (${appP?.desc ?? ''}): manter ${p.room.count > 1 ? `${p.room.count} câmaras iguais` : 'uma câmara'} a ${p.room.Tin} °C e ${Math.round(p.room.RHin * 100)}% de umidade relativa, armazenando ${prod.name.toLowerCase()} e recebendo ${n(p.product.dailyMass, 0)} kg/dia, que entram a ${p.product.Tenter} °C e devem atingir ${p.product.Tfinal} °C em ${p.product.coolingHours} h.`);
  h2('1.3 Características da instalação');
  bullets([
    ...(water ? [] : [
      `Câmara: ${n(g.L, 2)} × ${n(g.W, 2)} m em planta, pé-direito interno de ${n(g.H, 2)} m; área de ${n(g.floor, 1)} m² e volume de ${n(g.volume, 0)} m³ por câmara.`,
      `Envelope: painéis termoisolantes (${ins.name}); paredes de ${p.envelope.wallThk} mm, teto de ${p.envelope.roofThk} mm e piso ${p.envelope.floorInsulated ? `isolado com ${p.envelope.floorThk} mm` : 'sem isolamento'}.`,
      `Portas: ${p.doors.length ? p.doors.map((d, i) => `P-${String(i + 1).padStart(2, '0')}: ${d.count} × ${DOOR_TYPES.find((t) => t.id === d.type)?.name.toLowerCase()} de ${n(d.width, 2)} × ${n(d.height, 2)} m (${DOOR_PROTECTION[d.protection].name.toLowerCase()})`).join('; ') : 'nenhuma porta configurada'}.`,
      `Evaporadores (resfriadores de ar): ${l.evaps.length} por câmara, suspensos junto à parede do fundo, com degelo ${({ ar: 'natural por ar', agua: 'por água', 'gas-quente': 'por gás quente', eletrico: 'elétrico', nenhum: '(sem degelo)' } as Record<string, string>)[sys.defrost]}.`,
    ]),
    `Sistema frigorífico: amônia (R717), ${archName?.name.toLowerCase()}. ${archName?.desc}`,
    `Sala de máquinas com compressores parafuso, reservatório de líquido${l.equips.some((e) => e.kind === 'separador') ? ', separador de líquido' : ''}${l.equips.some((e) => e.kind === 'bomba') ? ', bombas de amônia' : ''}${l.equips.some((e) => e.kind === 'intercooler') ? ', resfriador intermediário' : ''}${l.equips.some((e) => e.kind === 'trocador') ? ', trocador a placas' : ''}, quadro de válvulas, painel elétrico, detecção de NH3 e exaustão de emergência.`,
    'Rejeição de calor por condensador evaporativo instalado em área externa.',
    ...(p.cadImport ? [`Geometria importada do arquivo CAD ${p.cadImport.fileName} (${p.cadImport.format.toUpperCase()} ${p.cadImport.version}), unidade ${p.cadImport.unit}, rotação ${p.cadImport.rotationDeg}°, em ${new Date(p.cadImport.importedAt).toLocaleDateString('pt-BR')}. Parâmetros importados: ${Object.keys(p.cadImport.provenance).join(', ') || 'nenhum'}.${p.cadImport.warnings.length ? ' Avisos da importação: ' + p.cadImport.warnings.join('; ') : ''}`] : []),
  ]);
  h2('1.4 Condições de operação e de projeto');
  table([{ h: 'Parâmetro', w: 50 }, { h: 'Valor', w: 30, a: 'r' }, { h: 'Origem', w: 20 }], [
    ...(water ? [] : [['Temperatura interna', `${p.room.Tin} °C`, 'Informado'], ['Umidade relativa interna', `${Math.round(p.room.RHin * 100)} %`, 'Informado']]),
    ['Temperatura externa de projeto (bulbo seco)', `${p.climate.Tout} °C`, p.confirmed.clima ? 'Informado (confirmado)' : 'Informado'],
    ['Umidade relativa externa', `${Math.round(p.climate.RHout * 100)} %`, 'Informado'],
    ['Temperatura de bulbo úmido', `${n(ev.temps.twb, 1)} °C`, 'Calculado (psicrometria)'],
    ...(water ? [] : [['Temperatura sob o piso', `${p.climate.Tground} °C`, 'Informado'], ['Correção solar paredes / teto', `${SOLAR[p.climate.solarWalls].wall} / ${SOLAR[p.climate.solarRoof].roof} K`, 'ASHRAE (referência)']]),
    ['Operação dos compressores', `${sys.runHours} h/dia`, 'Informado'],
    ['Dias de operação', `${p.finance.operatingDays} dias/ano`, 'Informado'],
    ['Temperatura de evaporação adotada', `${n(ev.temps.Te, 1)} °C`, 'Calculado'],
    ['Temperatura de condensação adotada', `${n(ev.temps.Tc, 1)} °C`, 'Calculado'],
  ]);
  h2('1.5 Premissas e hipóteses de cálculo');
  table([{ h: 'Hipótese', w: 55 }, { h: 'Valor adotado', w: 25, a: 'r' }, { h: 'Natureza', w: 20 }], [
    ['Diferença ar–evaporação (TD)', `${sys.evapTD} K`, 'Hipótese editável'], ['Penalidade de perda de carga na sucção', '1 K', 'Hipótese'],
    ['Aproximação do condensador ao bulbo úmido', `${sys.condApproach} K`, 'Hipótese editável'], ['Eficiência isentrópica / motor', `${n(sys.etaIs * 100)} % / ${n(sys.etaMotor * 100)} %`, 'Hipótese editável'],
    ['Superaquecimento / sub-resfriamento', `${sys.superheat} K / ${sys.subcool} K`, 'Hipótese editável'], ['Fator de segurança', `${n(sys.safetyFactor * 100)} %`, 'ASHRAE (~10 %)'],
    ['Pontes térmicas sobre a transmissão', `${p.envelope.thermalBridgePct} %`, 'Hipótese editável'], ['Condutividade do isolante (λ)', `${n(ev.loads.nominal.memo?.lambda ?? ins.lambda, 3)} W/(m·K)`, p.envelope.lambdaOverride ? 'Informado' : 'Literatura (EN 13163)'],
    ['Ventiladores: Δp / η / ΔT do ar', `${sys.fanDp} Pa / ${n(sys.fanEta * 100)} % / ${sys.airDT} K`, 'Hipótese editável'], ['Eficiência do degelo', `${n(sys.defrostEff * 100)} %`, 'Hipótese editável'],
    ['Auxiliares do condensador', `${sys.condAuxPct} % de Qc`, 'Hipótese editável'], ['Resistência de marco (congelados)', `${sys.frameHeaterWm} W/m`, 'Hipótese editável'],
  ]);

  }
  // ================= 2. MEMORIAL DE CÁLCULO =================
  if (sec('calculo')) {
  h1('2. Memorial de cálculo');
  if (water) {
    h2('2.1 Carga do processo');
    const pr = p.process;
    formula([
      'Q = V · rho · cp · (Te - Ts)',
      `Q = (${n(pr.flow, 2)} / 3600) m³/s · 1000 kg/m³ · 4,19 kJ/(kg·K) · (${pr.Tin} - ${pr.Tout}) K = ${n(ev.loads.nominal.processKW ?? 0, 1)} kW (pico)`,
      `E = Q · t = ${n(ev.loads.nominal.processKW ?? 0, 1)} kW · ${pr.hoursPerDay} h = ${n(ev.loads.nominal.totalKWhDay, 0)} kWh/dia`,
      pr.strategy === 'banco-gelo' ? `Banco de gelo: Q_req = E / t_carga · (1 + fs) = ${n(ev.loads.nominal.totalKWhDay, 0)} / ${Math.min(22, sys.runHours)} h · ${n(1 + sys.safetyFactor, 2)} = ${n(ev.loads.nominal.requiredKW, 1)} kW` : `Chiller direto: Q_req = Q_pico · (1 + fs) = ${n(ev.loads.nominal.requiredKW, 1)} kW`,
    ]);
  } else if (m) {
    h2('2.1 Geometria');
    formula([
      `A_piso = C · L = ${n(g.L, 2)} · ${n(g.W, 2)} = ${n(g.floor, 2)} m²`,
      `V = A_piso · H = ${n(g.floor, 2)} · ${n(g.H, 2)} = ${n(g.volume, 1)} m³`,
      `A_paredes = 2 · (C + L) · H = 2 · (${n(g.L, 2)} + ${n(g.W, 2)}) · ${n(g.H, 2)} = ${n(g.wallGross, 1)} m²`,
      `A_portas = soma(l · h · qtd) = ${n(g.doorArea, 2)} m²   ->   A_paredes,líquida = ${n(g.wallNet, 1)} m²`,
      `Quantidade de câmaras iguais: n = ${p.room.count} (todas as cargas são multiplicadas por n)`,
    ]);
    h2('2.2 Transmissão pelo envelope');
    formula([
      'U = 1 / (1/hi + e/lambda + 1/he)      hi = 8 W/(m²·K), he = 25 W/(m²·K)',
      `U_parede = 1 / (1/8 + ${n(p.envelope.wallThk / 1000, 3)}/${n(m.lambda, 3)} + 1/25) = ${n(ev.loads.nominal.U.wall, 3)} W/(m²·K)`,
      'Q_t = (soma U·A·dT) · (1 + pontes térmicas);   dT = T_ext + correção solar - T_int',
    ]);
    const tsum = m.surfaces.reduce((a, s) => a + s.W, 0);
    table([{ h: 'Superfície', w: 30 }, { h: 'Área [m²]', w: 14, a: 'r' }, { h: 'U [W/(m²·K)]', w: 16, a: 'r' }, { h: 'dT [K]', w: 12, a: 'r' }, { h: 'Q [W]', w: 14, a: 'r' }], [
      ...m.surfaces.map((s) => [s.name, n(s.A, 1), n(s.U, 3), n(s.dT, 1), n(s.W, 0)]),
      ['Subtotal · (1 + ' + n(p.envelope.thermalBridgePct) + ' %) · n', '', '', '', n(tsum * m.bridge * m.n, 0)],
    ], { total: true });
    para(`Energia diária de transmissão: ${n(tsum * m.bridge * m.n, 0)} W · 24 h = ${n(items.transmissao.kWhDay, 1)} kWh/dia.`);
    h2('2.3 Infiltração pelas portas (Gosney & Olama, ASHRAE)');
    formula([
      'q = 0,221 · A · (hi - hr) · rho_r · (1 - rho_i/rho_r)^0,5 · (g · H)^0,5 · Fm          [kW]',
      'Fm = [2 / (1 + (rho_r/rho_i)^(1/3))]^1,5',
      'Dt = (P · theta_p + 60 · theta_o) / (3600 · theta_d)          qt = q · Dt · Df · (1 - E) · qtd',
      `Df = ${n(m.Df, 2)} (nominal da faixa de 0,7 a 1,1); E conforme a proteção (nominal da faixa da literatura)`,
    ]);
    if (m.doors.length) {
      table([{ h: 'Porta', w: 9 }, { h: 'A [m²]', w: 9, a: 'r' }, { h: 'H [m]', w: 8, a: 'r' }, { h: 'rho_r / rho_i [kg/m³]', w: 17, a: 'r' }, { h: 'hr / hi [kJ/kg]', w: 15, a: 'r' }, { h: 'Fm', w: 8, a: 'r' }, { h: 'q aberta [kW]', w: 11, a: 'r' }, { h: 'Dt [%]', w: 9, a: 'r' }, { h: 'E', w: 7, a: 'r' }, { h: 'qt [kW]', w: 10, a: 'r' }],
        m.doors.map((d) => {
          const i = p.doors.findIndex((x) => x.id === d.id);
          return [`P-${String(i + 1).padStart(2, '0')}`, n(d.A, 2), n(d.H, 2), `${n(d.rhoR, 3)} / ${n(d.rhoI, 3)}`, `${n(d.hR, 1)} / ${n(d.hI, 1)}`, n(d.Fm, 3), n(d.qFull, 2), n(d.Dt * 100, 2), n(d.E, 2), n(d.q, 3)];
        }), { size: 7.6 });
      para(`Infiltração total: ${n(items.infiltracao.kWhDay, 1)} kWh/dia (${n(items.infiltracao.kWhDay / 24, 2)} kW médios). Umidade infiltrada que forma gelo: ${n(ev.loads.nominal.frostKgDay, 1)} kg/dia.`);
    } else para('Nenhuma porta configurada: infiltração nula no modelo. Frestas e renovações de ar não são consideradas.');
    h2('2.4 Produtos');
    const pm = m.product;
    const freezes = pm.tf !== null && pm.T2 < pm.tf && pm.T1 > pm.tf;
    formula([
      freezes ? 'E = m · [cp1 · (T1 - Tf) + L + cp2 · (Tf - T2)] + m · f_emb · cp_emb · (T1 - T2)'
        : pm.tf !== null && pm.T1 <= pm.tf ? 'E = m · cp2 · (T1 - T2) + m · f_emb · cp_emb · (T1 - T2)   (produto já congelado: sem calor latente)'
          : 'E = m · cp1 · (T1 - T2) + m · f_emb · cp_emb · (T1 - T2)',
      `m = ${n(pm.m, 0)} kg/dia; T1 = ${pm.T1} °C; T2 = ${pm.T2} °C${pm.tf !== null ? `; Tf = ${pm.tf} °C` : ''}; cp1 = ${n(pm.cp1, 3)}; cp2 = ${n(pm.cp2, 3)} kJ/(kg·K); L = ${n(pm.L, 1)} kJ/kg`,
      `E = ${n(pm.eKJ, 0)} kJ/dia = ${n(pm.eKJ / 3600, 1)} kWh/dia por câmara${pm.respKW > 0 ? `; respiração = ${n(pm.respKW * 1000, 0)} W` : ''}`,
      `Taxa durante o processo: E / t = ${n(pm.eKJ / 3600, 1)} / ${p.product.coolingHours} h = ${n(pm.eKJ / 3600 / Math.max(0.5, p.product.coolingHours), 2)} kW`,
    ]);
    note(`Propriedades de ${pm.name} por equações de Siebel a partir do teor de água típico (ASHRAE Refrigeration, cap. 19). São valores aproximados.`);
    h2('2.5 Cargas internas, ventiladores e degelo');
    formula([
      `Pessoas: q = 272 - 6 · t = ${n(m.qPerson * 1000, 0)} W/pessoa -> ${p.internal.people} · ${n(m.qPerson, 3)} kW · ${p.internal.peopleHours} h = ${n(items.pessoas.kWhDay / m.n, 2)} kWh/dia`,
      `Iluminação: ${p.internal.lightingWm2} W/m² · ${n(g.floor, 1)} m² · ${p.internal.lightingHours} h = ${n(items.iluminacao.kWhDay / m.n, 2)} kWh/dia`,
      `Equipamentos: ${p.internal.equipmentKW} kW · ${p.internal.equipmentHours} h = ${n(items.equipamentos.kWhDay / m.n, 2)} kWh/dia`,
      `Ventiladores: V = Q / (rho · cp · dT_ar);  P = V · dp / eta = ${n(m.fan.Vdot, 2)} m³/s · ${n(m.fan.dp, 0)} Pa / ${n(m.fan.eta, 2)} = ${n(m.fan.kW, 2)} kW · ${m.fan.hours} h`,
      `Degelo: E = m_gelo · (334 + 2,05 · |T|) · (1/eta - 1) = ${n(m.frost, 1)} kg · ... · (1/${n(m.etaD, 2)} - 1) = ${n(m.eDefKWh, 2)} kWh/dia; marcos: ${n(m.heaterKWh, 2)} kWh/dia`,
    ]);
  }
  h2(`2.${water ? 2 : 6} Resumo das cargas térmicas`);
  const tot = ev.loads.nominal.totalKWhDay || 1;
  table([{ h: 'Parcela', w: 40 }, { h: 'Energia [kWh/dia]', w: 20, a: 'r' }, { h: 'Potência média [kW]', w: 20, a: 'r' }, { h: 'Participação [%]', w: 20, a: 'r' }], [
    ...ev.loads.nominal.items.filter((i) => i.kWhDay > 0.0005).map((i) => [LOAD_LABEL[i.key], n(i.kWhDay, 1), n(i.avgKW, 2), n((i.kWhDay / tot) * 100, 1)]),
    ['Total', n(ev.loads.nominal.totalKWhDay, 1), n(ev.loads.nominal.avgKW, 2), '100,0'],
  ], { total: true });
  h2(`2.${water ? 3 : 7} Capacidade frigorífica requerida`);
  formula([
    `Q_média = E_total / t_op = ${n(ev.loads.nominal.totalKWhDay, 1)} / ${water && p.process.strategy === 'chiller' ? p.process.hoursPerDay : sys.runHours} h = ${n(ev.loads.nominal.capacityAvgBasis, 2)} kW`,
    `Q_pico = cargas contínuas + produto concentrado no tempo de processo = ${n(ev.loads.nominal.capacityPeakBasis, 2)} kW`,
    `Q_req = max(Q_média; Q_pico) · (1 + fs) = ${n(Math.max(ev.loads.nominal.capacityAvgBasis, ev.loads.nominal.capacityPeakBasis), 2)} · ${n(1 + sys.safetyFactor, 2)} = ${n(ev.loads.nominal.requiredKW, 2)} kW (${n(ev.loads.nominal.requiredKW / 3.517, 1)} TR)`,
    `Faixa: ${n(ev.loads.baixo.requiredKW, 1)} a ${n(ev.loads.alto.requiredKW, 1)} kW pelas incertezas da literatura, com margem de +/-${n(QUALITY_INFO[ev.quality].extra * 100)} % pela qualidade dos dados -> ${n(ev.range[0], 0)} a ${n(ev.range[1], 0)} kW`,
  ]);
  h2(`2.${water ? 4 : 8} Ciclo termodinâmico (R717)`);
  formula([
    water ? `Te = ${p.process.strategy === 'banco-gelo' ? '-10 °C (formação de gelo, hipótese)' : `T_água - 5 K = ${n(ev.temps.Te, 1)} °C`}` : `Te = T_int - TD - 1 K${sys.architecture === 'indireto' ? ' - 6 K (fluido secundário)' : ''} = ${n(ev.temps.Te, 1)} °C  ->  Pe = ${n(satT(ev.temps.Te).P / 100, 3)} bar abs`,
    `Tc = Tbu + aproximação = ${n(ev.temps.twb, 1)} + ${sys.condApproach} = ${n(ev.temps.Tc, 1)} °C (limitada a 25-50 °C)  ->  Pc = ${n(satT(ev.temps.Tc).P / 100, 3)} bar abs`,
    'h2 = h1 + (h2s - h1) / eta_is;   m = Q / q_e;   W = m · (h2 - h1);   Qc = m · (h2 - h3);   COP = Q / (W/eta_m + W_bombas)',
  ]);
  if (!c.errors.length) {
    table([{ h: 'Ponto', w: 30 }, { h: 'P [bar]', w: 10, a: 'r' }, { h: 'T [°C]', w: 10, a: 'r' }, { h: 'h [kJ/kg]', w: 12, a: 'r' }, { h: 's [kJ/(kg·K)]', w: 13, a: 'r' }, { h: 'x', w: 8, a: 'r' }],
      c.states.map((s) => [`${s.id} · ${s.label}`, n(s.P / 100, 3), n(s.T, 1), n(s.h, 1), n(s.s, 4), s.x === null ? (s.phase === 'vapor' ? 'SA' : 'SR') : n(s.x, 3)]), { size: 7.8 });
    kv([
      ['Efeito frigorífico q_e', `${n(c.qe, 1)} kJ/kg`], ['Vazão mássica de NH3', `${n(c.mdot * 3600, 0)} kg/h${c.mdotHP ? ` (alta: ${n(c.mdotHP * 3600, 0)} kg/h)` : ''}`],
      ['Vazão volumétrica na sucção', `${n(c.Vsuction, 1)} m³/h`], ['Potência no eixo / elétrica', `${n(c.W, 2)} kW / ${n(c.Welec, 2)} kW`],
      ['Calor rejeitado Qc', `${n(c.Qc, 2)} kW`], ['Temperatura de descarga', `${n(Math.max(c.Tdis, c.Tdis2 ?? -999), 1)} °C`],
      ['Relação de compressão', n(c.pressureRatio, 2)], ['COP / COP de Carnot', `${n(c.COP, 2)} / ${n(c.COPcarnot, 2)}`],
      ['Verificação do balanço (1ª lei)', `|Q + W - Qc| / Qc = ${c.balanceError.toExponential(1)}`],
    ]);
    note('Propriedades do R717 por interpolação de tabelas geradas com o CoolProp 6.6, com referência IIR (h = 200 kJ/kg e s = 1 kJ/(kg·K) no líquido saturado a 0 °C). SA: vapor superaquecido; SR: líquido sub-resfriado.');
  } else c.errors.forEach((e) => para('Ciclo sem solução válida: ' + e, 9, [192, 57, 43]));
  h2(`2.${water ? 5 : 9} Referências`);
  bullets(SOURCES.filter((s) => !s.id.startsWith('engefril') || ['engefril-evap', 'engefril-cond', 'engefril-painel', 'engefril-portas', 'engefril-rar', 'engefril-chiller', 'engefril-tanque'].includes(s.id)).map((s) => `${s.title}${s.url ? ` (${s.url})` : ''}`), 8);
  note('As referências ASHRAE, IIAR, ABNT e NR são citadas de conhecimento técnico, sem verificação nesta edição. Confira-as na edição vigente antes de usar em projeto.');

  }
  // ================= 3. DESENHOS TÉCNICOS =================
  if (sec('desenhos')) {
  drawingSheets();

  }
  // ================= 4. ESPECIFICAÇÃO DE EQUIPAMENTOS =================
  if (sec('equipamentos')) {
  h1('4. Especificação de equipamentos');
  para('Capacidades estimadas pelo simulador. A Engefril não publica capacidades nem modelos: a seleção final exige catálogo do fabricante e orçamento técnico-comercial. As TAGs identificam os itens nos desenhos e não são códigos de produto.', 8.6, GREY);
  const specRows = equipmentSchedule(p, ev, l).map((r) => [r.tag, r.name, r.fn, r.capacity, r.facts]);
  table([{ h: 'TAG', w: 8 }, { h: 'Equipamento', w: 20 }, { h: 'Função', w: 24 }, { h: 'Capacidade estimada', w: 22 }, { h: 'Características disponíveis (Engefril)', w: 26 }], specRows, { size: 7.4 });
  h2('4.1 Famílias de solução sugeridas');
  suggestEquipment(p, ev).forEach((s) => { para(`${s.category}${s.product ? ` (referência: ${s.product})` : ''}`, 9, NAVY, 'bold'); para(s.why, 8.6); para('Falta para selecionar: ' + s.missing.join('; ') + '.', 8, GREY, 'italic'); });

  }
  // ================= 5. QUADRO DE DIMENSIONAMENTO =================
  if (sec('dimensionamento')) {
  h1('5. Quadro de dimensionamento');
  if (!water) {
    h2('5.1 Câmaras frigoríficas');
    table([{ h: 'Item', w: 12 }, { h: 'Qtd', w: 6, a: 'r' }, { h: 'C × L × A [m]', w: 22, a: 'r' }, { h: 'Área [m²]', w: 12, a: 'r' }, { h: 'Volume [m³]', w: 12, a: 'r' }, { h: 'T / UR', w: 14, a: 'r' }, { h: 'Carga [kW]', w: 12, a: 'r' }, { h: 'W/m³', w: 10, a: 'r' }], [
      ['CF-01', String(p.room.count), `${n(g.L, 2)} × ${n(g.W, 2)} × ${n(g.H, 2)}`, n(g.floor, 1), n(g.volume, 0), `${p.room.Tin} °C / ${Math.round(p.room.RHin * 100)} %`, n(ev.loads.nominal.requiredKW / p.room.count, 1), n((ev.loads.nominal.requiredKW * 1000) / (g.volume * p.room.count), 1)],
    ]);
    h2('5.2 Portas');
    if (p.doors.length) table([{ h: 'TAG', w: 7 }, { h: 'Tipo', w: 24 }, { h: 'l × h [m]', w: 12, a: 'r' }, { h: 'Qtd', w: 5, a: 'r' }, { h: 'Parede', w: 10 }, { h: 'Passagens', w: 12, a: 'r' }, { h: 'Proteção', w: 15 }, { h: 'Lado externo', w: 12, a: 'r' }, { h: 'Carga [kW]', w: 10, a: 'r' }],
      p.doors.map((d, i) => [`P-${String(i + 1).padStart(2, '0')}`, DOOR_TYPES.find((t) => t.id === d.type)?.name ?? d.type, `${n(d.width, 2)} × ${n(d.height, 2)}`, String(d.count), d.wall, `${d.passagesPerHour}/h · ${d.hoursPerDay} h`, DOOR_PROTECTION[d.protection].name, `${d.adjacentT} °C / ${Math.round(d.adjacentRH * 100)} %`, n(ev.loads.nominal.doorDetails.find((x) => x.id === d.id)?.kW ?? 0, 2)]), { size: 7.6 });
    else para('Nenhuma porta configurada.');
    h2('5.3 Painéis termoisolantes');
    const mem = ev.loads.nominal.memo;
    table([{ h: 'Superfície', w: 22 }, { h: 'Espessura [mm]', w: 14, a: 'r' }, { h: 'Área por câmara [m²]', w: 16, a: 'r' }, { h: 'Área total [m²]', w: 14, a: 'r' }, { h: 'U [W/(m²·K)]', w: 14, a: 'r' }, { h: 'Q [W] por câmara', w: 14, a: 'r' }], [
      ['Paredes', String(p.envelope.wallThk), n(g.wallNet, 1), n(g.wallNet * p.room.count, 1), n(ev.loads.nominal.U.wall, 3), n(mem?.surfaces[0].W ?? 0, 0)],
      ['Teto', String(p.envelope.roofThk), n(g.roof, 1), n(g.roof * p.room.count, 1), n(ev.loads.nominal.U.roof, 3), n(mem?.surfaces[2].W ?? 0, 0)],
      ['Piso', p.envelope.floorInsulated ? String(p.envelope.floorThk) : 'sem isolamento', n(g.floor, 1), n(g.floor * p.room.count, 1), n(ev.loads.nominal.U.floor, 3), n(mem?.surfaces[3].W ?? 0, 0)],
    ]);
    note(`Núcleo: ${ins.name}. Os painéis Engefril têm núcleo EPS de 15 kg/m³ e chapas de 0,50 mm (dado oficial); a espessura do painel não é publicada.`);
  }
  h2(`5.${water ? 1 : 4} Equipamentos frigoríficos`);
  table([{ h: 'Item', w: 26 }, { h: 'Qtd', w: 6, a: 'r' }, { h: 'Dimensionamento preliminar', w: 48 }, { h: 'Condição', w: 20 }], [
    ...(water ? [] : [['Evaporadores', String(nEv * p.room.count), `${n(evKW, 1)} kW cada; vazão de ar total de ~${n((ev.loads.nominal.memo?.fan.Vdot ?? 0) * 3600, 0)} m³/h por câmara`, `TD ${sys.evapTD} K; passo de aletas ${p.room.Tin > 0 ? '5' : p.room.Tin > -18 ? '8' : '11,2'} mm`]]),
    ['Condensador evaporativo', '1', `${n(c.Qc, 1)} kW rejeitados`, `Tbu ${n(ev.temps.twb, 1)} °C; Tc ${n(ev.temps.Tc, 1)} °C`],
    ['Compressores', String(comps.length), `${n(c.Vsuction, 0)} m³/h na sucção; ${n(c.Welec, 1)} kW elétricos totais`, `Relação ${n(c.pressureRatio, 1)}; descarga ${n(Math.max(c.Tdis, c.Tdis2 ?? -999), 0)} °C`],
    ...(l.equips.some((e) => e.kind === 'separador') ? [['Separador de líquido', '1', `Vapor de sucção de ${n(c.Vsuction, 0)} m³/h`, `${n(satT(ev.temps.Te).P / 100, 2)} bar abs`]] : []),
    ['Reservatório de líquido', '1', 'Volume a definir pela carga de NH3', `${n(satT(ev.temps.Tc).P / 100, 2)} bar abs; NR-13`],
    ...(l.equips.some((e) => e.kind === 'bomba') ? [['Bombas de amônia', String(l.equips.filter((e) => e.kind === 'bomba' && e.id !== 'bomba-glicol').length), `${n(c.Wpump, 2)} kW estimados (1 operação + 1 reserva)`, 'Taxa de recirculação 4 (hipótese)']] : []),
  ]);

  }
  // ================= 6. ANÁLISE ENERGÉTICA =================
  if (sec('energia')) {
  h1('6. Análise energética');
  table([{ h: 'Consumidor', w: 50 }, { h: 'Potência [kW]', w: 25, a: 'r' }, { h: 'Participação [%]', w: 25, a: 'r' }], [
    ['Compressores (elétrica)', n(e.compKW, 2), n((e.compKW / e.totalElecKW) * 100, 1)],
    ['Auxiliares do condensador (ventiladores e bomba)', n(e.auxKW, 2), n((e.auxKW / e.totalElecKW) * 100, 1)],
    ['Ventiladores dos evaporadores', n(e.fanKW, 2), n((e.fanKW / e.totalElecKW) * 100, 1)],
    ['Bombas', n(e.pumpKW, 2), n((e.pumpKW / e.totalElecKW) * 100, 1)],
    ['Total', n(e.totalElecKW, 2), '100,0'],
  ], { total: true });
  kv([
    ['Consumo diário', `${n(e.kWhDay, 0)} kWh/dia`], ['Consumo anual', `${n(e.kWhYear, 0)} kWh/ano (${p.finance.operatingDays} dias)`],
    ['Custo de energia', `${brl(e.costYear)}/ano a ${n(p.finance.tariff, 2)} R$/kWh (tarifa informada)`],
    ['Eficiência', `COP do ciclo ${n(c.COP, 2)}; ${n((c.COP / c.COPcarnot) * 100, 0)} % do COP de Carnot; ${n(ev.loads.nominal.requiredKW / Math.max(1e-9, e.totalElecKW), 2)} kW frig./kW elét. global`],
  ]);
  note(e.seasonalNote);
  barChart('Distribuição da carga térmica diária', ev.breakdown.map((b) => ({ label: b.label, v: b.kWhDay, txt: `${n(b.share * 100, 0)} % · ${n(b.kWhDay, 0)} kWh/dia` })));
  if (!water) {
    h2('6.1 Comparação entre arquiteturas (mesma carga e condensação)');
    const archs = compareArchitectures(p, ev);
    table([{ h: 'Arquitetura', w: 36 }, { h: 'Te [°C]', w: 10, a: 'r' }, { h: 'COP', w: 10, a: 'r' }, { h: 'kW elét.', w: 12, a: 'r' }, { h: 'Descarga [°C]', w: 12, a: 'r' }, { h: 'Observação', w: 30 }],
      archs.map((a) => [a.name + (a.id === p.system.architecture ? ' (adotada)' : ''), n(a.Te, 1), a.cycle.errors.length ? '-' : n(a.cycle.COP, 2), a.cycle.errors.length ? '-' : n(a.cycle.Welec + a.cycle.Wpump, 1), a.cycle.errors.length ? '-' : n(Math.max(a.cycle.Tdis, a.cycle.Tdis2 ?? -999), 0), a.cycle.errors[0] ?? a.cycle.warnings[0] ?? '-']), { size: 7.6 });
  }
  if (opts.compare) {
    const B = opts.compare, eb = evaluate(B), cmp = compare(p, ev, B, eb);
    h2('6.2 Comparação de cenários A × B');
    table([{ h: 'Indicador', w: 34 }, { h: 'A', w: 22, a: 'r' }, { h: 'B', w: 22, a: 'r' }, { h: 'B - A', w: 22, a: 'r' }], [
      ['Capacidade requerida [kW]', n(ev.loads.nominal.requiredKW, 1), n(eb.loads.nominal.requiredKW, 1), n(eb.loads.nominal.requiredKW - ev.loads.nominal.requiredKW, 1)],
      ['Carga diária [kWh/dia]', n(ev.loads.nominal.totalKWhDay, 0), n(eb.loads.nominal.totalKWhDay, 0), n(eb.loads.nominal.totalKWhDay - ev.loads.nominal.totalKWhDay, 0)],
      ['Potência elétrica [kW]', n(e.totalElecKW, 1), n(eb.energy.totalElecKW, 1), n(eb.energy.totalElecKW - e.totalElecKW, 1)],
      ['Consumo [MWh/ano]', n(e.kWhYear / 1000, 1), n(eb.energy.kWhYear / 1000, 1), n((eb.energy.kWhYear - e.kWhYear) / 1000, 1)],
      ['Custo de energia [R$/ano]', brl(e.costYear), brl(eb.energy.costYear), brl(eb.energy.costYear - e.costYear)],
      ['COP do ciclo', n(c.COP, 2), n(eb.cycle.COP, 2), n(eb.cycle.COP - c.COP, 2)],
    ]);
    para(`Payback simples: ${cmp.payback ? `${n(cmp.payback, 1)} anos` : 'não calculado'}. ${cmp.note}${p.finance.investmentSource ? ` Origem dos valores: ${p.finance.investmentSource}.` : ''}`, 8.6);
  }

  }
  // ================= 7. CONCLUSÕES =================
  if (sec('conclusoes')) {
  h1('7. Conclusões técnicas');
  h2('7.1 Resultados');
  bullets([
    water ? `Carga de processo de ${n(ev.loads.nominal.processKW ?? 0, 0)} kW de pico e ${n(ev.loads.nominal.totalKWhDay, 0)} kWh/dia.` : `Carga térmica média de ${n(ev.loads.nominal.avgKW, 1)} kW (${n(ev.loads.nominal.totalKWhDay, 0)} kWh/dia); as maiores parcelas são ${ev.breakdown.slice(0, 2).map((b) => `${b.label.toLowerCase()} (${n(b.share * 100, 0)} %)`).join(' e ')}.`,
    `Capacidade frigorífica preliminar de ${n(ev.loads.nominal.requiredKW, 1)} kW, na faixa de ${n(ev.range[0], 0)} a ${n(ev.range[1], 0)} kW (estimativa ${QUALITY_INFO[ev.quality].label.toLowerCase()}).`,
    `Ciclo de ${n(ev.temps.Te, 1)} / ${n(ev.temps.Tc, 1)} °C com COP de ${n(c.COP, 2)}; potência elétrica de cerca de ${n(e.totalElecKW, 0)} kW e consumo de ${n(e.kWhYear / 1000, 0)} MWh/ano.`,
  ]);
  h2('7.2 Recomendações');
  bullets(ev.insights.length ? ev.insights : ['Nenhuma parcela de carga domina o cenário; priorize confirmar os dados de maior sensibilidade.']);
  h2('7.3 Limitações');
  bullets([
    'Regime permanente na condição de projeto: sem carga parcial, sazonalidade, condensação flutuante ou inércia térmica.',
    'Perdas de carga de tubulação representadas por uma penalidade equivalente de temperatura; tubulações não dimensionadas.',
    'Hipóteses do item 1.5 devem ser substituídas por dados de projeto e de fabricantes.',
    'Os desenhos são esquemáticos, a partir das dimensões informadas; o arranjo da sala de máquinas é ilustrativo.',
  ], 8.6);
  h2('7.4 Informações necessárias para o projeto executivo');
  bullets(ev.missing, 8.6);
  K.Disclaimer(DISCLAIMER + ' Requisitos legais aplicáveis incluem a NR-13 (vasos de pressão), entre outros.');

  }
  // ---------------- gráfico de barras vetorial

  // ================= desenhos =================
  function drawingSheets() {
    // seção do sumário aponta para a primeira folha
    const sheets: (() => void)[] = [];
    sheets.push(sheetPlan, sheetMachineRoom);
    if (!water) sheets.push(sheetSections);
    sheets.push(sheetDiagram);
    let first = true;
    for (const s of sheets) {
      newPage('desenho');
      if (first) { toc.push({ title: `${++secN}. Desenhos técnicos`, page: page(), level: 1 }); first = false; }
      s();
    }
  }
  /** Área útil do desenho (acima da legenda). */
  /** Cota horizontal entre x1 e x2 (papel), linha de cota em yd, linhas de chamada a partir de ye. */
  function rectW(x0: number, z0: number, x1: number, z1: number, tf: (x: number, z: number) => [number, number], style: 'S' | 'F' | 'FD' = 'S') {
    const [a, b] = tf(Math.min(x0, x1), Math.min(z0, z1)), [c2, d] = tf(Math.max(x0, x1), Math.max(z0, z1));
    doc.rect(Math.min(a, c2), Math.min(b, d), Math.abs(c2 - a), Math.abs(d - b), style);
  }

  // ---------- Folha 1: planta baixa geral
  function sheetPlan() {
    const A = area();
    const tw = p.envelope.wallThk / 1000;
    const half = Math.max(l.W / 2 + tw, 7.2);
    const x0 = -23.6, x1 = l.L + tw + 0.5, z0 = -half - 0.6, z1 = half + 0.6;
    const scale = chooseScale([x1 - x0, z1 - z0], [A.w - 26, A.h - 30]);
    const k = 1000 / scale;
    const ox = A.x + 8 + (A.w - 26 - (x1 - x0) * k) / 2, oy = A.y + 6 + (A.h - 30 - (z1 - z0) * k) / 2;
    const tf = (x: number, z: number): [number, number] => [ox + (x - x0) * k, oy + (z - z0) * k];
    sheetHead('PLANTA BAIXA GERAL: sala de máquinas, câmara e condensador', `1:${scale}`);
    // sala de máquinas (paredes de 0,20 m)
    const mr = l.machineRoom;
    doc.setFillColor(205, 210, 215); T.line(0.35); rectW(mr.min[0] - 0.2, mr.min[2] - 0.2, mr.max[0] + 0.2, mr.max[2] + 0.2, tf, 'FD');
    doc.setFillColor(255, 255, 255); rectW(mr.min[0], mr.min[2], mr.max[0], mr.max[2], tf, 'FD');
    // câmara (ou tanque)
    if (!water) {
      doc.setFillColor(242, 230, 166); T.line(0.35); rectW(-tw, -l.W / 2 - tw, l.L + tw, l.W / 2 + tw, tf, 'FD');
      doc.setFillColor(255, 255, 255); rectW(0, -l.W / 2, l.L, l.W / 2, tf, 'FD');
      // vãos de porta e símbolos
      doors.forEach((pd) => {
        const a = doorWorldX(pd, l.L, l.W, pd.u0), b = doorWorldX(pd, l.L, l.W, pd.u1);
        const out = pd.wall === 'frente' ? [0, 1] : pd.wall === 'fundo' ? [0, -1] : pd.wall === 'esquerda' ? [-1, 0] : [1, 0];
        // vão: retângulo entre a face interna e a externa do painel
        doc.setFillColor(255, 255, 255);
        rectW(a.x, a.z, b.x + out[0] * tw, b.z + out[1] * tw, tf, 'F');
        T.line(0.25, BLUE);
        const [ax, ay] = tf(a.x + out[0] * tw, a.z + out[1] * tw), [bx, by] = tf(b.x + out[0] * tw, b.z + out[1] * tw);
        const wmm = Math.hypot(bx - ax, by - ay);
        const ux = (bx - ax) / wmm, uy = (by - ay) / wmm;
        const vx = out[0], vy = out[1];
        if (pd.door.type === 'giratoria' || pd.door.type === 'portinhola') {
          doc.line(ax, ay, ax + vx * wmm, ay + vy * wmm);
          const segs = 10; let px = bx, py = by;
          for (let s = 1; s <= segs; s++) { const t = (s / segs) * (Math.PI / 2); const qx = ax + ux * wmm * Math.cos(t) + vx * wmm * Math.sin(t), qy = ay + uy * wmm * Math.cos(t) + vy * wmm * Math.sin(t); T.dash(true); doc.line(px, py, qx, qy); px = qx; py = qy; }
          T.dash(false);
        } else if (pd.door.type === 'seccional') {
          T.dash(true); doc.line(ax, ay, bx, by); T.dash(false);
        } else {
          const off = 0.6; doc.rect(Math.min(ax, bx) + vx * off, Math.min(ay, by) + vy * off, Math.abs(bx - ax) + Math.abs(vx) * 0.6, Math.abs(by - ay) + Math.abs(vy) * 0.6);
          doc.line(bx + vx * (off + 0.3), by + vy * (off + 0.3), bx + ux * wmm + vx * (off + 0.3), by + uy * wmm + vy * (off + 0.3));
        }
        font(6, 'bold', BLUE);
        doc.text(doorTag(pd), (ax + bx) / 2 + vx * 4.2, (ay + by) / 2 + vy * 4.2 + 1, { align: 'center' });
      });
      // linhas de corte A-A e B-B
      T.line(0.3, [192, 57, 43]); doc.setLineDashPattern([4, 1, 0.6, 1], 0);
      const [ca1, cb1] = tf(-17.5, 0), [ca2, cb2] = tf(l.L + tw + 0.4, 0); doc.line(ca1, cb1, ca2, cb2);
      const [cc1, cd1] = tf(l.L / 2, -l.W / 2 - tw - 0.4), [cc2, cd2] = tf(l.L / 2, l.W / 2 + tw + 0.4); doc.line(cc1, cd1, cc2, cd2);
      T.dash(false); font(7.5, 'bold', [192, 57, 43]);
      doc.text('A', ca1 - 3, cb1 + 1); doc.text('A', ca2 + 1.5, cb2 + 1); doc.text('B', cc1 - 1, cd1 - 1.5); doc.text('B', cc2 - 1, cd2 + 3.5);
    }
    // equipamentos (projeção). Na escala geral, itens pequenos da sala de máquinas ficam só em contorno (ver folha de detalhe)
    const detailMR = scale > 200;
    l.equips.forEach((eq) => {
      if (eq.kind === 'camara') return;
      const inMR = eq.pos[0] < -1.2;
      drawEquip(eq, tf, k, !(detailMR && inMR && eq.kind !== 'condensador'));
    });
    // textos de ambiente
    font(7, 'bold', NAVY);
    const [mx, my] = tf((mr.min[0] + mr.max[0]) / 2, mr.max[2] - 1.2); doc.text(clean('SALA DE MÁQUINAS'), mx, my, { align: 'center' });
    if (detailMR) { font(5.6, 'italic', GREY); doc.text(clean('detalhe na folha seguinte'), mx, my + 2.6, { align: 'center' }); }
    font(7, 'bold', NAVY);
    const [kx, ky] = tf(-21.5, -3.8); doc.text(clean('ÁREA EXTERNA'), kx, ky, { align: 'center' });
    if (!water) { const [rx, ry] = tf(l.L / 4, -l.W / 4); font(7.5, 'bold', NAVY); doc.text(clean(`CÂMARA FRIGORÍFICA · ${p.room.Tin} °C`), rx, ry, { align: 'center' }); font(6.5, 'normal', GREY); doc.text(clean(`Ap = ${n(g.floor, 1)} m² · V = ${n(g.volume, 0)} m³ · H = ${m2(l.H)} m`), rx, ry + 3.2, { align: 'center' }); }
    else { const [rx, ry] = tf(l.L / 2 + 0.5, l.W / 2 + 0.2); font(7, 'bold', NAVY); doc.text('TANQUE DE ÁGUA GELADA / BANCO DE GELO', rx, ry + 3, { align: 'center' }); }
    // cotas
    const [, yb] = tf(0, z1); const yd1 = yb + 7, yd2 = yb + 13;
    if (!water) {
      const [xa] = tf(0, 0), [xb] = tf(l.L, 0), [xao] = tf(-tw, 0), [xbo] = tf(l.L + tw, 0);
      // corrente de portas na parede frontal
      const front = doors.filter((d) => d.wall === 'frente').sort((a, b) => a.u0 - b.u0);
      let last = 0;
      const [, yf] = tf(0, l.W / 2 + tw);
      for (const d of front) { const [p0] = tf(last, 0), [p1] = tf(d.u0, 0), [p2] = tf(d.u1, 0); dimH(p0, p1, yf + 1, yd1, m2(d.u0 - last)); dimH(p1, p2, yf + 1, yd1, m2(d.u1 - d.u0)); last = d.u1; }
      if (front.length) { const [p0] = tf(last, 0); dimH(p0, xb, yf + 1, yd1, m2(l.L - last)); }
      else dimH(xa, xb, yf + 1, yd1, m2(l.L));
      dimH(xao, xbo, yf + 1, yd2, `${m2(l.L + 2 * tw)} (externo)`);
      const [xr] = tf(l.L + tw, 0); const [, za] = tf(0, -l.W / 2), [, zb] = tf(0, l.W / 2);
      dimV(za, zb, xr + 1, xr + 10, m2(l.W));
      const [, zao] = tf(0, -l.W / 2 - tw), [, zbo] = tf(0, l.W / 2 + tw); dimV(zao, zbo, xr + 1, xr + 17, `${m2(l.W + 2 * tw)} (ext.)`);
      font(6.2, 'normal', GREY); doc.text(clean(`Painéis: paredes e = ${p.envelope.wallThk} mm · teto e = ${p.envelope.roofThk} mm`), xbo, yd2 + 5, { align: 'right' });
    }
    const [m1] = tf(mr.min[0] - 0.2, 0), [m2x] = tf(mr.max[0] + 0.2, 0), [, mtop] = tf(0, mr.min[2] - 0.2);
    dimH(m1, m2x, mtop - 1, mtop - 6, m2(mr.max[0] - mr.min[0] + 0.4));
    const [c1] = tf(-23, 0), [c2] = tf(-20, 0), [, ctop] = tf(0, -3); dimH(c1, c2, ctop - 1, ctop - 6, '3,00');
    if (!water) { const [g1] = tf(mr.max[0] + 0.2, 0), [g2] = tf(-tw, 0); dimH(g1, g2, mtop - 1, mtop - 6, m2(-tw - mr.max[0] - 0.2)); }
    scaleBar(A.x + 4, A.y + A.h - 6, k, scale);
    legendBox(A.x + 112, A.y + A.h - 13, [['tracejado', 'Equipamento acima do piso (suspenso ou na cobertura)'], ['amarelo', 'Painel termoisolante (seção)'], ['traço-ponto', 'Linha de corte']]);
    font(6, 'italic', GREY); doc.text(clean('Cotas em metros. Orientação geográfica não informada. Arranjo da sala de máquinas ilustrativo.'), A.x + 4, A.y + A.h + 1);
  }
  /** Equipamento em planta: contorno (tracejado se acima do piso) e TAG, interna quando cabe ou com linha de chamada. */
  function drawEquip(eq: Layout['equips'][number], tf: (x: number, z: number) => [number, number], k: number, withTag: boolean) {
    const [x, , z] = eq.pos, [sx, , sz] = eq.size;
    const overhead = eq.kind === 'evaporador' || (eq.kind === 'separador' && l.arch !== 'dx') || eq.kind === 'sensor' || eq.kind === 'exaustor';
    T.line(0.22, overhead ? GREY : NAVY); T.dash(overhead);
    if (eq.kind === 'intercooler') { const [cx, cy] = tf(x, z); doc.setFillColor(222, 236, 248); doc.circle(cx, cy, (sx / 2) * k, 'FD'); }
    else if (eq.kind === 'sensor') { const [cx, cy] = tf(x, z); doc.circle(cx, cy, 0.9, 'S'); }
    else { doc.setFillColor(...(overhead ? [255, 255, 255] as RGB : eq.kind === 'tanque' ? [222, 236, 248] as RGB : [232, 238, 244] as RGB)); rectW(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2, tf, overhead ? 'S' : 'FD'); }
    T.dash(false);
    if (!withTag) return;
    const [cx, cy] = tf(x, z);
    font(5.6, 'bold', NAVY);
    const t = tags[eq.id];
    const tw0 = doc.getTextWidth(t);
    if (eq.kind === 'sensor') { doc.text(t, cx + 1.4, cy - 1.2); return; }
    if (sx * k >= tw0 + 1 && sz * k >= 2.6 && eq.kind !== 'separador') doc.text(t, cx, cy + 0.9, { align: 'center' });
    else {
      // TAG fora do contorno, com linha de chamada (bombas sob o separador ficam abaixo; demais acima)
      const below = eq.kind === 'bomba';
      const ty0 = below ? cy + (sz * k) / 2 + 4.5 : cy - (sz * k) / 2 - 3.2;
      T.line(0.12, GREY); doc.line(cx, below ? cy + (sz * k) / 2 : cy - (sz * k) / 2, cx, below ? ty0 - 2 : ty0 + 0.6);
      doc.setFillColor(255, 255, 255); doc.rect(cx - tw0 / 2 - 0.5, ty0 - 2.1, tw0 + 1, 2.8, 'F');
      font(5.6, 'bold', NAVY); doc.text(t, cx, ty0, { align: 'center' });
    }
  }

  // ---------- Folha de detalhe: sala de máquinas
  function sheetMachineRoom() {
    const A = area();
    const land = K.W > K.H;
    const x0 = -23.6, x1 = -1.2, z0 = -7.8, z1 = 7.8;
    const keyW = land ? 74 : 0, keyH = land ? 0 : 52;
    const scale = chooseScale([x1 - x0, z1 - z0], [A.w - keyW - 24, A.h - keyH - 26]);
    const k = 1000 / scale;
    const ox = A.x + 10 + (A.w - keyW - 24 - (x1 - x0) * k) / 2, oy = A.y + 8 + (A.h - keyH - 26 - (z1 - z0) * k) / 2;
    const tf = (x: number, z: number): [number, number] => [ox + (x - x0) * k, oy + (z - z0) * k];
    sheetHead('DETALHE EM PLANTA: sala de máquinas e condensador', `1:${scale}`);
    const mr = l.machineRoom;
    doc.setFillColor(205, 210, 215); T.line(0.35); rectW(mr.min[0] - 0.2, mr.min[2] - 0.2, mr.max[0] + 0.2, mr.max[2] + 0.2, tf, 'FD');
    doc.setFillColor(255, 255, 255); rectW(mr.min[0], mr.min[2], mr.max[0], mr.max[2], tf, 'FD');
    // traçado esquemático das linhas de NH3 dentro da sala (projeção)
    l.routes.forEach((r) => {
      const col = hex(LINE_INFO[r.kind].color);
      T.line(0.35, col);
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1], b = r.pts[i];
        if (Math.max(a[0], b[0]) > -1.3) continue;
        const cz = (v: number) => Math.max(z0 + 0.3, Math.min(z1 - 0.3, v)); // limita à área da folha
        const [ax, ay] = tf(a[0], cz(a[2])), [bx, by] = tf(b[0], cz(b[2]));
        if (Math.hypot(bx - ax, by - ay) > 0.2) doc.line(ax, ay, bx, by);
      }
    });
    l.equips.filter((e) => e.pos[0] < -1.2).forEach((eq) => drawEquip(eq, tf, k, true));
    font(7.5, 'bold', NAVY);
    const [mx, my] = tf((mr.min[0] + mr.max[0]) / 2, mr.max[2] - 0.9); doc.text(clean('SALA DE MÁQUINAS'), mx, my, { align: 'center' });
    const [kx, ky] = tf(-21.5, -4.2); doc.text(clean('ÁREA EXTERNA'), kx, ky, { align: 'center' });
    // cotas
    const [m1] = tf(mr.min[0] - 0.2, 0), [m2x] = tf(mr.max[0] + 0.2, 0), [, mb] = tf(0, mr.max[2] + 0.2);
    dimH(m1, m2x, mb + 1, mb + 7, m2(mr.max[0] - mr.min[0] + 0.4));
    const [mi1] = tf(mr.min[0], 0), [mi2] = tf(mr.max[0], 0); dimH(mi1, mi2, mb + 1, mb + 13, `${m2(mr.max[0] - mr.min[0])} (interno)`);
    const [, zt] = tf(0, mr.min[2] - 0.2), [, zbm] = tf(0, mr.max[2] + 0.2), [xr] = tf(mr.max[0] + 0.2, 0);
    dimV(zt, zbm, xr + 1, xr + 7, m2(mr.max[2] - mr.min[2] + 0.4));
    const cd = l.equips.find((e) => e.kind === 'condensador');
    if (cd) {
      const [c1] = tf(cd.pos[0] - cd.size[0] / 2, 0), [c2] = tf(cd.pos[0] + cd.size[0] / 2, 0), [, ct] = tf(0, cd.pos[2] - cd.size[2] / 2), [, cb] = tf(0, cd.pos[2] + cd.size[2] / 2);
      dimH(c1, c2, ct - 1, ct - 6, m2(cd.size[0])); dimV(ct, cb, c1 - 1, c1 - 6, m2(cd.size[2]));
      const [w1] = tf(cd.pos[0] + cd.size[0] / 2, 0), [w2] = tf(mr.min[0] - 0.2, 0); dimH(w1, w2, cb + 1, cb + 6, m2(mr.min[0] - 0.2 - cd.pos[0] - cd.size[0] / 2));
    }
    const c1e = l.equips.find((e) => e.id === 'compressor-1');
    if (c1e) { const [a1] = tf(c1e.pos[0] - c1e.size[0] / 2, 0), [a2] = tf(c1e.pos[0] + c1e.size[0] / 2, 0), [, at] = tf(0, c1e.pos[2] - c1e.size[2] / 2); dimH(a1, a2, at - 1, at - 5, m2(c1e.size[0])); }
    scaleBar(A.x + 4, A.y + A.h - 6, k, scale);
    // quadro de identificação
    const items = l.equips.filter((e) => e.pos[0] < -1.2);
    const kx0 = land ? A.x + A.w - keyW + 2 : A.x, ky0 = land ? A.y + 4 : A.y + A.h - keyH - 6;
    font(7, 'bold', NAVY); doc.text(clean('IDENTIFICAÇÃO'), kx0, ky0);
    const rowH = land ? 4.4 : 3.9;
    const perCol = land ? items.length : Math.ceil(items.length / 2);
    items.forEach((e, i) => {
      const col = Math.floor(i / perCol), row = i % perCol;
      const xx = kx0 + col * (A.w / 2), yy = ky0 + 4.5 + row * rowH;
      font(6.2, 'bold', NAVY); doc.text(tags[e.id], xx, yy);
      font(5.8, 'normal', INK); doc.text(clean(`${e.label} (${m2(e.size[0])} × ${m2(e.size[2])} m)`), xx + 10, yy, { maxWidth: (land ? keyW : A.w / 2) - 12 });
    });
    legendBox(A.x + 112, A.y + A.h - 13, [['tracejado', 'Acima do piso (suspenso, elevado ou na parede)'], ['#e4572e', 'Linhas de NH3 (cores conforme o diagrama do circuito)']]);
    font(6, 'italic', GREY); doc.text(clean('Cotas em metros. Arranjo ilustrativo da sala de máquinas gerado pela plataforma; posição real a definir no projeto executivo.'), A.x + 4, A.y + A.h + 1);
  }

  function legendBox(x: number, y0: number, rows: [string, string][]) {
    font(6, 'normal', INK);
    rows.forEach(([kind, txt], i) => {
      const yy = y0 + i * 4.2;
      if (kind === 'tracejado') { T.line(0.25, GREY); T.dash(true); doc.rect(x, yy - 2, 6, 2.6); T.dash(false); }
      else if (kind === 'amarelo') { doc.setFillColor(242, 230, 166); T.line(0.2); doc.rect(x, yy - 2, 6, 2.6, 'FD'); }
      else if (kind === 'traço-ponto') { T.line(0.3, [192, 57, 43]); doc.setLineDashPattern([2, 0.8, 0.4, 0.8], 0); doc.line(x, yy - 0.7, x + 6, yy - 0.7); T.dash(false); }
      else { doc.setFillColor(...hex(kind)); doc.rect(x, yy - 1.8, 6, 2, 'F'); }
      font(6, 'normal', INK); doc.text(clean(txt), x + 8, yy);
    });
  }

  // ---------- Folha de cortes e vista frontal (cada desenho com escala própria, centralizado na sua região)
  function sheetSections() {
    const A = area();
    const tw = p.envelope.wallThk / 1000, tr = p.envelope.roofThk / 1000, tfl = p.envelope.floorInsulated ? p.envelope.floorThk / 1000 : 0;
    const land = K.W > K.H;
    sheetHead('CORTES A-A e B-B e VISTA FRONTAL', 'indicadas');
    type R = { x: number; y: number; w: number; h: number };
    const regions: R[] = land
      ? [{ x: A.x, y: A.y, w: A.w, h: A.h * 0.5 }, { x: A.x, y: A.y + A.h * 0.5 + 2, w: A.w / 2 - 4, h: A.h * 0.5 - 2 }, { x: A.x + A.w / 2 + 4, y: A.y + A.h * 0.5 + 2, w: A.w / 2 - 4, h: A.h * 0.5 - 2 }]
      : [0, 1, 2].map((i) => ({ x: A.x, y: A.y + (i * A.h) / 3, w: A.w, h: A.h / 3 - 2 }));
    /** Encaixa uma extensão (m) na região, reservando espaço para título (topo), cotas (base e direita). */
    const fit = (r: R, ext: [number, number], title: string) => {
      const avail: [number, number] = [r.w - 28, r.h - 22];
      const scale = chooseScale(ext, avail);
      const k = 1000 / scale;
      const ox = r.x + 6 + (avail[0] - ext[0] * k) / 2, oy = r.y + 8 + (avail[1] - ext[1] * k) / 2;
      font(8, 'bold', NAVY); doc.text(clean(`${title}  ·  ESC. 1:${scale}`), r.x, r.y + 2);
      return { k, ox, oy };
    };
    const levels = Math.max(1, Math.min(5, Math.floor((l.H - 1.4) / 1.7)));
    const stackH = Math.min(l.H - 1.4, levels * 1.7);
    // ---- Corte A-A: longitudinal (plano z = 0, olhando para o fundo)
    {
      const xmin = -tw - 0.4, xmax = l.L + tw + 0.4, ymin = -tfl - 0.3, ymax = l.H + tr + 0.3;
      const { k, ox, oy } = fit(regions[0], [xmax - xmin, ymax - ymin], 'CORTE A-A (longitudinal)');
      const tf = (x: number, yy: number): [number, number] => [ox + (x - xmin) * k, oy + (ymax - yy) * k];
      T.line(0.4, INK); const [g0x, g0y] = tf(xmin, -tfl), [g1x] = tf(xmax, -tfl); doc.line(g0x, g0y, g1x, g0y);
      doc.setFillColor(242, 230, 166); T.line(0.3, INK);
      rectW(-tw, 0, 0, l.H, tf, 'FD'); rectW(l.L, 0, l.L + tw, l.H, tf, 'FD'); rectW(-tw, l.H, l.L + tw, l.H + tr, tf, 'FD');
      if (tfl > 0) rectW(0, -tfl, l.L, 0, tf, 'FD');
      T.line(0.3, INK); const [f0x, f0y] = tf(0, 0), [f1x] = tf(l.L, 0); doc.line(f0x, f0y, f1x, f0y);
      l.evaps.forEach((e) => { T.line(0.22, NAVY); doc.setFillColor(232, 238, 244); rectW(e.pos[0] - e.size[0] / 2, e.pos[1] - 0.5, e.pos[0] + e.size[0] / 2, e.pos[1] + 0.5, tf, 'FD'); const [tx, ty] = tf(e.pos[0], e.pos[1]); font(5.4, 'bold', NAVY); if (e.size[0] * k > doc.getTextWidth(tags[e.id]) + 1) doc.text(tags[e.id], tx, ty + 0.8, { align: 'center' }); });
      T.line(0.2, GREY); T.dash(true); rectW(1, 0, Math.max(1.5, l.L - 1), stackH, tf, 'S'); T.dash(false);
      const [sx, sy] = tf(l.L / 2, stackH / 2); font(6, 'normal', GREY); doc.text(clean(`zona de estocagem: ${levels} nível(is) de paletes (ilustrativo)`), sx, sy, { align: 'center' });
      const [xr] = tf(l.L + tw, 0); const [, yb0] = tf(0, 0), [, yH] = tf(0, l.H), [, yR] = tf(0, l.H + tr);
      dimV(yb0, yH, xr + 1, xr + 6, `H = ${m2(l.H)}`); dimV(yH, yR, xr + 1, xr + 12, m2(tr));
      if (tfl > 0) { const [, yf] = tf(0, -tfl); dimV(yb0, yf, xr + 1, xr + 12, m2(tfl)); }
      if (l.evaps[0]) { const e0 = l.evaps[0]; const [, ye1] = tf(0, e0.pos[1] - 0.5); const [xe] = tf(e0.pos[0] - e0.size[0] / 2, 0); dimV(yb0, ye1, xe - 1, xe - 5, m2(e0.pos[1] - 0.5)); }
      const [xl] = tf(0, 0), [xrr] = tf(l.L, 0); dimH(xl, xrr, g0y + 1, g0y + 6, `C = ${m2(l.L)}`);
      font(5.8, 'normal', GREY); doc.text(clean(`paredes e = ${p.envelope.wallThk} mm · teto e = ${p.envelope.roofThk} mm · piso ${tfl > 0 ? `isolado e = ${p.envelope.floorThk} mm` : 'sem isolamento'}`), xl, g0y + 11);
    }
    // ---- Corte B-B: transversal (plano x = C/2)
    {
      const zmin = -l.W / 2 - tw - 0.4, zmax = l.W / 2 + tw + 0.4, ymin = -tfl - 0.3, ymax = l.H + tr + 0.3;
      const { k, ox, oy } = fit(regions[1], [zmax - zmin, ymax - ymin], 'CORTE B-B (transversal)');
      const tf = (z: number, yy: number): [number, number] => [ox + (z - zmin) * k, oy + (ymax - yy) * k];
      T.line(0.4, INK); const [g0x, g0y] = tf(zmin, -tfl), [g1x] = tf(zmax, -tfl); doc.line(g0x, g0y, g1x, g0y);
      doc.setFillColor(242, 230, 166); T.line(0.3, INK);
      rectW(-l.W / 2 - tw, 0, -l.W / 2, l.H, tf, 'FD'); rectW(l.W / 2, 0, l.W / 2 + tw, l.H, tf, 'FD'); rectW(-l.W / 2 - tw, l.H, l.W / 2 + tw, l.H + tr, tf, 'FD');
      if (tfl > 0) rectW(-l.W / 2, -tfl, l.W / 2, 0, tf, 'FD');
      const front = doors.filter((d) => d.wall === 'frente');
      if (front.length) { const hmax = Math.max(...front.map((d) => d.door.height + (d.door.type === 'portinhola' ? 0.9 : 0))); T.line(0.25, BLUE); T.dash(true); rectW(l.W / 2, 0, l.W / 2 + tw, hmax, tf, 'S'); T.dash(false); }
      T.line(0.2, GREY); T.dash(true); rectW(-l.W / 2 + 1.6, 0, l.W / 2 - 1.2, stackH, tf, 'S'); T.dash(false);
      const e0 = l.evaps[0];
      if (e0) {
        T.line(0.22, NAVY); doc.setFillColor(232, 238, 244); rectW(e0.pos[2] - e0.size[2] / 2, e0.pos[1] - 0.5, e0.pos[2] + e0.size[2] / 2, e0.pos[1] + 0.5, tf, 'FD');
        const [ax, ay] = tf(e0.pos[2] + e0.size[2] / 2 + 0.2, e0.pos[1]), [ax2] = tf(l.W / 2 - 0.6, 0);
        T.line(0.3, [70, 179, 230]); T.dash(true); doc.line(ax, ay, ax2, ay); T.dash(false); doc.setFillColor(70, 179, 230); doc.triangle(ax2, ay, ax2 - 1.8, ay - 0.8, ax2 - 1.8, ay + 0.8, 'F');
        font(5.6, 'normal', [31, 111, 209]); doc.text(clean('jato de ar frio'), (ax + ax2) / 2, ay - 1.3, { align: 'center' });
      }
      const [za] = tf(-l.W / 2, 0), [zb] = tf(l.W / 2, 0), [, y0] = tf(0, 0), [, yH] = tf(0, l.H);
      dimH(za, zb, g0y + 1, g0y + 6, `L = ${m2(l.W)}`);
      const [zr] = tf(l.W / 2 + tw, 0); dimV(y0, yH, zr + 1, zr + 6, m2(l.H));
      font(5.6, 'normal', GREY); doc.text(clean('fundo'), za, y0 - 1.2, { align: 'left' }); doc.text(clean('frente'), zb, y0 - 1.2, { align: 'right' });
    }
    // ---- Vista frontal (elevação externa da parede da frente)
    {
      const xmin = -tw - 0.4, xmax = l.L + tw + 0.4, ymax = l.H + tr + 0.3;
      const { k, ox, oy } = fit(regions[2], [xmax - xmin, ymax + 0.3], 'VISTA FRONTAL (parede da frente)');
      const tf = (x: number, yy: number): [number, number] => [ox + (x - xmin) * k, oy + (ymax - yy) * k];
      T.line(0.3, INK); doc.setFillColor(250, 246, 224); rectW(-tw, 0, l.L + tw, l.H + tr, tf, 'FD');
      T.line(0.4); const [g0x, g0y] = tf(xmin, 0), [g1x] = tf(xmax, 0); doc.line(g0x, g0y, g1x, g0y);
      const front = doors.filter((d) => d.wall === 'frente').sort((a, b) => a.u0 - b.u0);
      front.forEach((d, i) => {
        const y0 = d.door.type === 'portinhola' ? 0.9 : 0;
        doc.setFillColor(255, 255, 255); T.line(0.3, BLUE); rectW(d.u0, y0, d.u1, y0 + d.door.height, tf, 'FD');
        if (d.door.type === 'seccional') { T.line(0.12, BLUE); for (let q = 1; q < 4; q++) { const [a1, b1] = tf(d.u0, y0 + (d.door.height * q) / 4), [a2] = tf(d.u1, 0); doc.line(a1, b1, a2, b1); } }
        const [tx, ty] = tf((d.u0 + d.u1) / 2, y0 + d.door.height / 2); font(5.6, 'bold', BLUE);
        if ((d.u1 - d.u0) * k > doc.getTextWidth(doorTag(d)) + 0.6) doc.text(doorTag(d), tx, ty + 0.8, { align: 'center' });
        else doc.text(doorTag(d), tx, tf(0, y0 + d.door.height)[1] - 1.2, { align: 'center' });
        const [, yb] = tf(0, y0), [, yt] = tf(0, y0 + d.door.height), [xd] = tf(d.u1, 0);
        if (i === 0 || d.door.height !== front[i - 1].door.height) dimV(yb, yt, xd + 0.5, xd + 3.5, m2(d.door.height));
      });
      let last = 0;
      for (const d of front) { const [p0] = tf(last, 0), [p1] = tf(d.u0, 0), [p2] = tf(d.u1, 0); dimH(p0, p1, g0y + 1, g0y + 6, m2(d.u0 - last)); dimH(p1, p2, g0y + 1, g0y + 6, m2(d.u1 - d.u0)); last = d.u1; }
      const [pl] = tf(last, 0), [pe] = tf(l.L, 0); dimH(pl, pe, g0y + 1, g0y + 6, m2(l.L - last));
      const [xr] = tf(l.L + tw, 0), [, yR] = tf(0, l.H + tr); dimV(g0y, yR, xr + 1, xr + 9, m2(l.H + tr));
      if (!front.length) { font(6, 'italic', GREY); const [tx, ty] = tf(l.L / 2, l.H / 2); doc.text(clean('sem portas nesta parede'), tx, ty, { align: 'center' }); }
      const others = doors.filter((d) => d.wall !== 'frente');
      if (others.length) { font(5.6, 'normal', GREY); doc.text(doc.splitTextToSize(clean(`Portas em outras paredes: ${others.map((d) => `${doorTag(d)} (${d.wall}, ${m2(d.door.width)} × ${m2(d.door.height)} m)`).join('; ')}`), regions[2].w - 4), regions[2].x, regions[2].y + regions[2].h - 3); }
    }
    font(6, 'italic', GREY); doc.text(clean('Cotas em metros. Desenhos esquemáticos a partir das dimensões informadas; detalhes construtivos a definir no projeto executivo.'), A.x, A.y + A.h + 1);
  }

  // ---------- Folha 3: diagrama simplificado do circuito
  function sheetDiagram() {
    const A = area();
    sheetHead('DIAGRAMA SIMPLIFICADO DO CIRCUITO FRIGORÍFICO (sem escala)', 'sem escala');
    const land = K.W > K.H;
    const dw = land ? A.w * 0.64 : A.w, dh = land ? A.h - 18 : A.h * 0.55;
    const s = Math.min(dw / 250, dh / 135);
    const ox = A.x + 2, oy = A.y + 2;
    const P = (x: number, yy: number): [number, number] => [ox + x * s, oy + yy * s];
    const box = (x: number, yy: number, w: number, h: number, label: string, tag?: string) => {
      const [a, b] = P(x, yy); doc.setFillColor(232, 238, 244); T.line(0.35, NAVY); T.dash(false); doc.roundedRect(a, b, w * s, h * s, 1.2, 1.2, 'FD');
      font(Math.max(5.5, 6.6 * Math.min(1.2, s)), 'bold', NAVY); doc.text(doc.splitTextToSize(clean(label), w * s - 2), a + (w * s) / 2, b + (h * s) / 2 - (tag ? 0.6 : -0.6), { align: 'center' });
      if (tag) { font(5.4, 'normal', GREY); doc.text(tag, a + (w * s) / 2, b + (h * s) / 2 + 3, { align: 'center' }); }
    };
    const pipe = (kind: LineKind, pts: [number, number][], arrowEnd = true) => {
      const col = hex(LINE_INFO[kind].color);
      T.line(0.7, col); T.dash(false);
      for (let i = 1; i < pts.length; i++) { const [a, b] = P(...pts[i - 1]), [c2, d] = P(...pts[i]); doc.line(a, b, c2, d); }
      if (arrowEnd && pts.length > 1) {
        const [a, b] = P(...pts[pts.length - 2]), [c2, d] = P(...pts[pts.length - 1]);
        doc.setFillColor(...col); const L0 = Math.hypot(c2 - a, d - b) || 1, ux = (c2 - a) / L0, uy = (d - b) / L0, sz = 2;
        doc.triangle(c2, d, c2 - ux * sz - uy * sz * 0.45, d - uy * sz + ux * sz * 0.45, c2 - ux * sz + uy * sz * 0.45, d - uy * sz - ux * sz * 0.45, 'F');
      }
    };
    const valve = (x: number, yy: number) => { const [a, b] = P(x, yy); doc.setFillColor(255, 255, 255); T.line(0.35, INK); doc.triangle(a - 2.2, b - 1.6, a - 2.2, b + 1.6, a, b, 'FD'); doc.triangle(a + 2.2, b - 1.6, a + 2.2, b + 1.6, a, b, 'FD'); };
    const pump = (x: number, yy: number, tag: string) => { const [a, b] = P(x, yy); doc.setFillColor(255, 255, 255); T.line(0.35, NAVY); doc.circle(a, b, 2.6, 'FD'); doc.setFillColor(...NAVY); doc.triangle(a - 1.2, b - 1.4, a - 1.2, b + 1.4, a + 1.6, b, 'F'); font(5.4, 'normal', GREY); doc.text(tag, a, b + 5.2, { align: 'center' }); };
    const state = (id: string, x: number, yy: number) => { const [a, b] = P(x, yy); doc.setFillColor(255, 255, 255); T.line(0.3, BLUE); doc.circle(a, b, 2.1, 'FD'); font(6.4, 'bold', BLUE); doc.text(id, a, b + 0.9, { align: 'center' }); };
    const tg = (kind: string) => tags[l.equips.find((e) => e.kind === kind)?.id ?? ''] ?? '';
    const tcomp = l.equips.filter((e) => e.kind === 'compressor').map((e) => tags[e.id]);
    const arch = l.arch;
    const iceBank = water && p.process.strategy === 'banco-gelo';
    const hx = l.equips.some((e) => e.kind === 'trocador');
    const evLabel = water ? (iceBank ? 'Banco de gelo (serpentinas)' : 'Consumidor de água gelada') : `Evaporadores × ${nEv * p.room.count}`;
    const evTag = water ? tg('tanque') : `${tags[l.evaps[0]?.id ?? ''] ?? ''}${l.evaps.length > 1 ? ' a ' + tags[l.evaps[l.evaps.length - 1].id] : ''}`;
    box(10, 10, 40, 22, 'Condensador evaporativo', tg('condensador'));
    box(10, 60, 40, 14, 'Reservatório de líquido', tg('recipiente'));
    pipe('liquido-ap', [[30, 32], [30, 60]]);
    if (arch === 'duplo-estagio') {
      box(85, 15, 40, 18, 'Compressor BP', tcomp[0]); box(160, 15, 40, 18, 'Compressor AP', tcomp[1]);
      box(140, 45, 16, 30, 'Inter-cooler', tg('intercooler'));
      pipe('intermediario', [[125, 24], [144, 24], [144, 45]]);
      pipe('intermediario', [[152, 45], [152, 40], [180, 40], [180, 33]]);
      pipe('descarga', [[180, 15], [180, 5], [30, 5], [30, 10]]);
      pipe('liquido-ap', [[50, 67], [96, 67]], false); valve(100, 67); pipe('intermediario', [[104, 67], [140, 67]]);
      pipe('liquido-bp', [[148, 75], [148, 79], [60, 79], [60, 93], [66, 93]], false);
      state('1', 105, 55); state('2', 134, 24); state('3', 166, 40); state('4', 110, 5); state('5', 30, 46); state('6', 120, 67); state('7', 100, 79); state('8', 84, 93);
    } else {
      box(95, 15, 40, 18, `Compressor(es) × ${tcomp.length}`, tcomp.join(', '));
      pipe('descarga', [[95, 24], [60, 24], [60, 21], [50, 21]]);
      state('2', 75, 24); state('3', 55, 67);
    }
    if (arch === 'dx') {
      box(195, 82, 45, 22, evLabel, evTag);
      pipe('liquido-ap', [[50, 67], [60, 67], [60, 93], [66, 93]], false); valve(70, 93); pipe('retorno', [[74, 93], [195, 93]]);
      pipe('succao', [[217, 82], [217, 24], [135, 24]]);
      state('4', 120, 93); state('1', 180, 24);
    } else {
      box(95, 85, 50, 16, arch === 'gravidade' ? 'Separador de líquido (acima dos evaporadores)' : 'Separador de líquido', tg('separador'));
      if (arch !== 'duplo-estagio') { pipe('liquido-ap', [[50, 67], [60, 67], [60, 93], [66, 93]], false); state('4', 84, 93); }
      valve(70, 93); pipe('retorno', [[74, 93], [95, 93]]);
      pipe('succao', [[arch === 'duplo-estagio' ? 105 : 120, 85], [arch === 'duplo-estagio' ? 105 : 120, 33]]);
      if (arch !== 'duplo-estagio') state('1', 120, 55);
      const consumerX = hx ? 160 : 195;
      if (hx) box(160, 82, 26, 22, 'Trocador a placas', tg('trocador'));
      else box(195, 82, 45, 22, evLabel, evTag);
      if (arch === 'gravidade') pipe('liquido-bp', [[110, 101], [110, 112], [consumerX + 20, 112], [consumerX + 20, 104]]);
      else { pipe('liquido-bp', [[110, 101], [110, 115]], false); pump(110, 120, l.equips.filter((e) => e.kind === 'bomba' && e.id !== 'bomba-glicol').map((e) => tags[e.id]).join(' / ')); pipe('liquido-bp', [[113, 120], [consumerX + 13, 120], [consumerX + 13, 104]]); }
      pipe('retorno', [[consumerX, 93], [145, 93]]);
      if (hx) {
        box(205, 82, 40, 22, evLabel, evTag);
        pipe('secundario', [[186, 88], [205, 88]]);
        pipe('secundario', [[205, 98], [196, 98], [196, 112]], false); pump(196, 115, tags['bomba-glicol'] ?? 'BS'); pipe('secundario', [[193, 115], [190, 115], [190, 98], [186, 98]]);
      }
    }
    // legenda das linhas
    const kinds = [...new Set(l.routes.map((r) => r.kind))];
    const [lx, ly] = P(0, 128);
    kinds.forEach((kd, i) => {
      const xx = lx + (i % 3) * (dw / 3), yy = ly + Math.floor(i / 3) * 4.5;
      doc.setDrawColor(...hex(LINE_INFO[kd].color)); doc.setLineWidth(0.9); doc.line(xx, yy, xx + 7, yy);
      font(5.8, 'normal', INK); doc.text(clean(LINE_INFO[kd].name), xx + 9, yy + 1, { maxWidth: dw / 3 - 11 });
    });
    // tabela de estados
    const tx = land ? A.x + dw + 6 : A.x, ty = land ? A.y + 4 : A.y + dh + 16, twd = land ? A.w - dw - 6 : A.w;
    font(7.5, 'bold', NAVY); doc.text('ESTADOS TERMODINÂMICOS (R717)', tx, ty);
    const cols = [0.12, 0.2, 0.2, 0.24, 0.24].map((f) => f * twd);
    const head = ['Pto', 'P [bar]', 'T [°C]', 'h [kJ/kg]', 'x / fase'];
    let yy = ty + 5;
    doc.setFillColor(...NAVY); doc.rect(tx, yy - 3.4, twd, 5, 'F'); font(6.4, 'bold', [255, 255, 255]);
    let xx = tx; head.forEach((h, i) => { doc.text(clean(h), xx + 1.2, yy); xx += cols[i]; }); yy += 5;
    font(6.4, 'normal', INK);
    c.states.forEach((st, r) => {
      if (r % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(tx, yy - 3.4, twd, 4.6, 'F'); }
      const vals = [st.id, n(st.P / 100, 2), n(st.T, 1), n(st.h, 1), st.x === null ? (st.phase === 'vapor' ? 'vapor SA' : 'líquido SR') : n(st.x, 2)];
      xx = tx; vals.forEach((v, i) => { doc.text(clean(v), xx + 1.2, yy); xx += cols[i]; }); yy += 4.6;
    });
    yy += 2; font(6, 'normal', GREY);
    const desc = c.states.map((st) => `${st.id}: ${st.label}`).join(' · ');
    doc.text(doc.splitTextToSize(clean(desc), twd), tx, yy); yy += 10;
    font(6.4, 'normal', INK);
    const sumry = [`Te ${n(ev.temps.Te, 1)} °C · Tc ${n(ev.temps.Tc, 1)} °C`, `Q = ${n(ev.loads.nominal.requiredKW, 1)} kW · W = ${n(c.Welec, 1)} kW elét.`, `Qc = ${n(c.Qc, 1)} kW · COP = ${n(c.COP, 2)}`];
    sumry.forEach((t) => { doc.text(clean(t), tx, yy); yy += 3.8; });
    font(6, 'italic', GREY); doc.text(clean('Diagrama funcional simplificado: válvulas de serviço, segurança, controle, óleo e degelo omitidas. As cores identificam o estado do fluido e não a cor real.'), A.x, A.y + A.h + 1, { maxWidth: A.w });
  }

  return K.finalize(tocPage);
}

export const technicalFileName = (p: Project) => `${slug(p.name)}_relatorio_tecnico.pdf`;
